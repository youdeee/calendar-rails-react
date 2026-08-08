class RefreshToken < ApplicationRecord
  belongs_to :user

  EXPIRY = 30.days

  def self.issue!(user)
    raw_token = SecureRandom.hex(32)
    record = create!(
      user: user,
      token_digest: digest(raw_token),
      expires_at: EXPIRY.from_now
    )
    [raw_token, record]
  end

  def self.digest(raw_token)
    Digest::SHA256.hexdigest(raw_token)
  end

  def self.authenticate(raw_token)
    return nil if raw_token.blank?

    record = find_by(token_digest: digest(raw_token))
    return nil if record.nil?

    if record.revoked_at.present?
      record.user.refresh_tokens.where(revoked_at: nil).update_all(revoked_at: Time.current)
      return nil
    end

    return nil if record.expires_at < Time.current

    record
  end

  def revoke!
    update!(revoked_at: Time.current)
  end
end
