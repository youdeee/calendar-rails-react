require "rails_helper"

RSpec.describe User, type: :model do
  it "is valid with email, google_uid, name" do
    user = User.new(email: "a@example.com", google_uid: "google-1", name: "Taro")
    expect(user).to be_valid
  end

  it "requires a unique email" do
    User.create!(email: "dup@example.com", google_uid: "g-1", name: "A")
    dup = User.new(email: "dup@example.com", google_uid: "g-2", name: "B")
    expect(dup).not_to be_valid
  end

  it "requires a unique google_uid" do
    User.create!(email: "u1@example.com", google_uid: "dup-uid", name: "A")
    dup = User.new(email: "u2@example.com", google_uid: "dup-uid", name: "B")
    expect(dup).not_to be_valid
  end

  describe ".find_or_create_from_google!" do
    let(:payload) do
      { "sub" => "google-123", "email" => "new@example.com", "email_verified" => true,
        "name" => "New User", "picture" => "https://example.com/a.png" }
    end

    it "creates a new user from a verified Google payload" do
      user = User.find_or_create_from_google!(payload)
      expect(user).to be_persisted
      expect(user.email).to eq("new@example.com")
      expect(user.google_uid).to eq("google-123")
    end

    it "returns the existing user on subsequent calls" do
      first = User.find_or_create_from_google!(payload)
      second = User.find_or_create_from_google!(payload)
      expect(second.id).to eq(first.id)
    end

    it "raises when email_verified is false" do
      payload["email_verified"] = false
      expect { User.find_or_create_from_google!(payload) }.to raise_error(ArgumentError)
    end
  end

  it "rejects an unknown time zone" do
    user = User.new(email: "a@example.com", google_uid: "google-1", name: "Taro", time_zone: "Not/AZone")
    expect(user).not_to be_valid
  end
end
