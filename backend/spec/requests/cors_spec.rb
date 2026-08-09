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
end
