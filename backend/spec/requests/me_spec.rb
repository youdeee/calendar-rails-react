require "rails_helper"

RSpec.describe "GET /api/me", type: :request do
  let(:user) { User.create!(email: "a@example.com", google_uid: "g-1", name: "Taro") }

  it "returns the current user for a valid token" do
    token = JsonWebToken.encode(user.id)

    get "/api/me", headers: { "Authorization" => "Bearer #{token}" }

    expect(response).to have_http_status(:ok)
    expect(JSON.parse(response.body)["email"]).to eq("a@example.com")
  end

  it "returns 401 without a token" do
    get "/api/me"

    expect(response).to have_http_status(:unauthorized)
  end
end
