require "rails_helper"

RSpec.describe "Auth", type: :request do
  let(:google_payload) do
    { "sub" => "google-1", "email" => "a@example.com", "email_verified" => true,
      "name" => "Taro", "picture" => "https://example.com/a.png" }
  end

  describe "POST /api/auth/login" do
    it "creates a session for a valid Google id_token" do
      allow(GoogleIdTokenVerifier).to receive(:verify).and_return(google_payload)

      post "/api/auth/login", params: { id_token: "valid" }

      expect(response).to have_http_status(:created)
      body = JSON.parse(response.body)
      expect(body["access_token"]).to be_present
      expect(body["user"]["email"]).to eq("a@example.com")
      expect(response.cookies["refresh_token"]).to be_present
    end

    it "returns 401 for an invalid Google id_token" do
      allow(GoogleIdTokenVerifier).to receive(:verify).and_raise(GoogleIdTokenVerifier::InvalidToken)

      post "/api/auth/login", params: { id_token: "bad" }

      expect(response).to have_http_status(:unauthorized)
    end

    it "returns 401 when the Google email is not verified" do
      allow(GoogleIdTokenVerifier).to receive(:verify).and_return(google_payload.merge("email_verified" => false))

      post "/api/auth/login", params: { id_token: "valid" }

      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "DELETE /api/auth/logout" do
    it "revokes the refresh token and clears the cookie" do
      allow(GoogleIdTokenVerifier).to receive(:verify).and_return(google_payload)
      post "/api/auth/login", params: { id_token: "valid" }
      raw_refresh_token = response.cookies["refresh_token"]

      delete "/api/auth/logout", headers: { "Cookie" => "refresh_token=#{raw_refresh_token}" }

      expect(response).to have_http_status(:no_content)
      expect(RefreshToken.authenticate(raw_refresh_token)).to be_nil
    end

    it "returns 204 even when there is no refresh cookie" do
      delete "/api/auth/logout"

      expect(response).to have_http_status(:no_content)
    end
  end
end
