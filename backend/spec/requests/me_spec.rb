require "rails_helper"

RSpec.describe "GET /api/me", type: :request do
  let(:user) { User.create!(email: "a@example.com", google_uid: "g-1", name: "Taro") }

  it "returns the current user for a valid token" do
    token = JsonWebToken.encode(user.id)

    get "/api/me", headers: { "Authorization" => "Bearer #{token}" }

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    expect(body["email"]).to eq("a@example.com")
    expect(body["time_zone"]).to eq("Asia/Tokyo")
  end

  it "updates the time zone" do
    token = JsonWebToken.encode(user.id)

    patch "/api/me", params: { time_zone: "America/New_York" }, headers: { "Authorization" => "Bearer #{token}" }

    expect(response).to have_http_status(:ok)
    expect(JSON.parse(response.body)["time_zone"]).to eq("America/New_York")
    expect(user.reload.time_zone).to eq("America/New_York")
  end

  it "rejects an unknown time zone" do
    token = JsonWebToken.encode(user.id)

    patch "/api/me", params: { time_zone: "Not/AZone" }, headers: { "Authorization" => "Bearer #{token}" }

    expect(response).to have_http_status(:unprocessable_entity)
  end

  it "returns 401 without a token" do
    get "/api/me"

    expect(response).to have_http_status(:unauthorized)
  end
end
