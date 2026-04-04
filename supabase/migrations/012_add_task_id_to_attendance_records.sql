-- attendance_records に task_id カラムを追加（生徒が選択した開始ユニット）
ALTER TABLE attendance_records
  ADD COLUMN IF NOT EXISTS task_id uuid REFERENCES tasks(id) ON DELETE SET NULL;
