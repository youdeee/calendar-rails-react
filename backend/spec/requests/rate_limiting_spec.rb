require "rails_helper"

RSpec.describe "Rate limiting", type: :request do
  before do
    Rack::Attack.cache.store = ActiveSupport::Cache::MemoryStore.new
  end

  it "throttles POST /api/auth/login after 10 requests per minute per IP" do
    allow(GoogleIdTokenVerifier).to receive(:verify).and_raise(GoogleIdTokenVerifier::InvalidToken)

    10.times { post "/api/auth/login", params: { id_token: "x" } }
    post "/api/auth/login", params: { id_token: "x" }

    expect(response).to have_http_status(:too_many_requests)
  end
end
