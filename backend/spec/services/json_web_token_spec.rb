require "rails_helper"

RSpec.describe JsonWebToken do
  describe ".encode / .decode" do
    it "round-trips a user id" do
      token = described_class.encode(42)
      payload = described_class.decode(token)
      expect(payload["sub"]).to eq(42)
    end

    it "raises InvalidToken for a tampered token" do
      token = described_class.encode(42)
      expect { described_class.decode(token + "x") }.to raise_error(described_class::InvalidToken)
    end

    it "raises InvalidToken for an expired token" do
      token = travel_to(20.minutes.ago) { described_class.encode(42) }
      expect { described_class.decode(token) }.to raise_error(described_class::InvalidToken)
    end

    it "rejects tokens signed with alg: none" do
      none_token = JWT.encode({ sub: 42, exp: 1.hour.from_now.to_i }, nil, "none")
      expect { described_class.decode(none_token) }.to raise_error(described_class::InvalidToken)
    end
  end
end
