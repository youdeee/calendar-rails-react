class User < ApplicationRecord
  has_many :events, dependent: :destroy
  has_many :refresh_tokens, dependent: :destroy

  validates :email, presence: true, uniqueness: true
  validates :google_uid, presence: true, uniqueness: true
  validates :name, presence: true

  def self.find_or_create_from_google!(payload)
    raise ArgumentError, "email not verified" unless payload["email_verified"]

    user = find_or_initialize_by(email: payload["email"])
    user.google_uid = payload["sub"]
    user.name = payload["name"]
    user.avatar_url = payload["picture"]
    user.save!
    user
  end
end
