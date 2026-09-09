Rails.application.routes.draw do
  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html

  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  # Can be used by load balancers and uptime monitors to verify that the app is live.
  get "up" => "rails/health#show", as: :rails_health_check

  namespace :api do
    get "me", to: "/me#show"
    patch "me", to: "/me#update"

    namespace :auth do
      post "login", to: "/auth#login"
      post "refresh", to: "/auth#refresh"
      delete "logout", to: "/auth#logout"
    end

    resources :events, controller: "/events", only: %i[index create update destroy]
  end

  # Defines the root path route ("/")
  # root "posts#index"
end
