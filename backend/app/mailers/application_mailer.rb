class ApplicationMailer < ActionMailer::Base
  default from: "calendar@localhost"
  layout "mailer"
end
