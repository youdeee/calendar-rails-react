require "rails_helper"

RSpec.describe "CORS", type: :request do
  it "reflects the configured frontend origin" do
    get "/api/me", headers: { "Origin" => "http://localhost:5173", "Authorization" => "Bearer bogus" }

    expect(response.headers["Access-Control-Allow-Origin"]).to eq("http://localhost:5173")
  end

  it "does not allow an arbitrary origin" do
    get "/api/me", headers: { "Origin" => "http://evil.example.com", "Authorization" => "Bearer bogus" }

    expect(response.headers["Access-Control-Allow-Origin"]).to be_nil
  end

  it "allows credentials on /api/auth/* for the refresh cookie" do
    post "/api/auth/login", params: { id_token: "x" }, headers: { "Origin" => "http://localhost:5173" }

    expect(response.headers["Access-Control-Allow-Origin"]).to eq("http://localhost:5173")
    expect(response.headers["Access-Control-Allow-Credentials"]).to eq("true")
  end

  it "does not allow credentials on non-auth /api/* resources" do
    get "/api/me", headers: { "Origin" => "http://localhost:5173", "Authorization" => "Bearer bogus" }

    expect(response.headers["Access-Control-Allow-Credentials"]).to be_nil
  end
end
