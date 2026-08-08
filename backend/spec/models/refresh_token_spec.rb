require "rails_helper"

RSpec.describe RefreshToken, type: :model do
  let(:user) { User.create!(email: "a@example.com", google_uid: "g-1", name: "Taro") }

  describe ".issue!" do
    it "returns a raw token and persists only its digest" do
      raw_token, record = RefreshToken.issue!(user)
      expect(raw_token).to be_a(String)
      expect(record.token_digest).to eq(RefreshToken.digest(raw_token))
      expect(record.token_digest).not_to eq(raw_token)
      expect(record.expires_at).to be_within(1.minute).of(30.days.from_now)
    end
  end

  describe ".authenticate" do
    it "returns the record for a valid raw token" do
      raw_token, record = RefreshToken.issue!(user)
      expect(RefreshToken.authenticate(raw_token).id).to eq(record.id)
    end

    it "returns nil for an unknown token" do
      expect(RefreshToken.authenticate("bogus")).to be_nil
    end

    it "returns nil for an expired token" do
      raw_token, record = RefreshToken.issue!(user)
      record.update!(expires_at: 1.day.ago)
      expect(RefreshToken.authenticate(raw_token)).to be_nil
    end

    it "revokes the whole token family when a revoked token is reused" do
      raw_token, record = RefreshToken.issue!(user)
      _other_raw, other_record = RefreshToken.issue!(user)
      record.revoke!

      expect(RefreshToken.authenticate(raw_token)).to be_nil
      expect(other_record.reload.revoked_at).not_to be_nil
    end
  end

  describe "#revoke!" do
    it "sets revoked_at" do
      _raw_token, record = RefreshToken.issue!(user)
      expect { record.revoke! }.to change { record.revoked_at }.from(nil)
    end
  end
end
