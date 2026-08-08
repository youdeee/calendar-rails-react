require "rails_helper"

RSpec.describe GoogleIdTokenVerifier do
  describe ".verify" do
    around do |example|
      original = ENV["GOOGLE_CLIENT_ID"]
      ENV["GOOGLE_CLIENT_ID"] = "test-client-id"
      example.run
      ENV["GOOGLE_CLIENT_ID"] = original
    end

    it "returns the verified payload" do
      payload = { "sub" => "google-1", "email" => "a@example.com", "email_verified" => true }
      allow(Google::Auth::IDTokens).to receive(:verify_oidc).and_return(payload)

      expect(described_class.verify("valid-token")).to eq(payload)
    end

    it "wraps verification failures in InvalidToken" do
      allow(Google::Auth::IDTokens).to receive(:verify_oidc)
        .and_raise(Google::Auth::IDTokens::SignatureError, "bad signature")

      expect { described_class.verify("bad-token") }.to raise_error(GoogleIdTokenVerifier::InvalidToken)
    end
  end
end
