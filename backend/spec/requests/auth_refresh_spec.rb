require "rails_helper"

RSpec.describe "POST /api/auth/refresh", type: :request do
  let(:google_payload) do
    { "sub" => "google-1", "email" => "a@example.com", "email_verified" => true, "name" => "Taro" }
  end

  before do
    allow(GoogleIdTokenVerifier).to receive(:verify).and_return(google_payload)
    post "/api/auth/login", params: { id_token: "valid" }
  end

  it "issues a new access token and rotates the refresh token" do
    original = response.cookies["refresh_token"]

    post "/api/auth/refresh", headers: { "Cookie" => "refresh_token=#{original}" }

    expect(response).to have_http_status(:ok)
    new_refresh_token = response.cookies["refresh_token"]
    expect(new_refresh_token).to be_present
    expect(new_refresh_token).not_to eq(original)
    # Check the new token first: RefreshToken.authenticate has a theft-detection side
    # effect that revokes the whole family when called on an already-revoked token, so
    # checking `original` (revoked by this refresh) before `new_refresh_token` would
    # revoke the new token as a side effect and make the next assertion fail.
    expect(RefreshToken.authenticate(new_refresh_token)).to be_present
    expect(RefreshToken.authenticate(original)).to be_nil
  end

  it "returns 401 when there is no refresh cookie" do
    # Explicitly override the Cookie header (rather than omitting `headers:`) so the
    # refresh_token cookie set by the `before` block's login isn't auto-resent by the
    # test session's cookie jar, which would otherwise defeat this "no cookie" case.
    post "/api/auth/refresh", headers: { "Cookie" => "" }

    expect(response).to have_http_status(:unauthorized)
  end

  it "revokes the whole token family and returns 401 when a rotated-out token is reused" do
    original = response.cookies["refresh_token"]
    post "/api/auth/refresh", headers: { "Cookie" => "refresh_token=#{original}" }
    rotated = response.cookies["refresh_token"]

    post "/api/auth/refresh", headers: { "Cookie" => "refresh_token=#{original}" }

    expect(response).to have_http_status(:unauthorized)
    expect(RefreshToken.authenticate(rotated)).to be_nil
  end
end
