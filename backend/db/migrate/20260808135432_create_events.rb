class CreateEvents < ActiveRecord::Migration[7.1]
  def change
    create_table :events do |t|
      t.references :user, null: false, foreign_key: true
      t.string :title, null: false
      t.text :description
      t.datetime :start_at, null: false
      t.datetime :end_at, null: false
      t.boolean :all_day, null: false, default: false
      t.text :recurrence_rule

      t.timestamps
    end
    add_index :events, [:user_id, :start_at]
  end
end
