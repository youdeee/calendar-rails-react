class AddRemindersAndAllDayDates < ActiveRecord::Migration[8.1]
  def up
    add_column :users, :time_zone, :string, null: false, default: "Asia/Tokyo"

    add_column :events, :start_on, :date
    add_column :events, :end_on, :date
    add_column :events, :reminder_minutes, :integer

    tokyo = ActiveSupport::TimeZone["Tokyo"]
    Event.reset_column_information
    Event.where(all_day: true).find_each do |event|
      start_on = event.start_at.in_time_zone(tokyo).to_date
      end_on = (event.end_at - 1.second).in_time_zone(tokyo).to_date
      event.update_columns(start_on: start_on, end_on: end_on, start_at: nil, end_at: nil)
    end

    change_column_null :events, :start_at, true
    change_column_null :events, :end_at, true

    create_table :reminder_deliveries do |t|
      t.references :user, null: false, foreign_key: true
      t.references :event, null: false, foreign_key: true
      t.datetime :occurrence_start_at, null: false
      t.datetime :delivered_at
      t.timestamps
    end
    add_index :reminder_deliveries, [:event_id, :occurrence_start_at], unique: true
  end

  def down
    drop_table :reminder_deliveries
    change_column_null :events, :start_at, false
    change_column_null :events, :end_at, false
    remove_column :events, :reminder_minutes
    remove_column :events, :end_on
    remove_column :events, :start_on
    remove_column :users, :time_zone
  end
end
