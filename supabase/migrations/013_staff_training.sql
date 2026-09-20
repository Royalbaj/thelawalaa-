CREATE TABLE IF NOT EXISTS training_videos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  youtube_url TEXT NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_by  UUID REFERENCES profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE training_videos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff read active training videos" ON training_videos;
CREATE POLICY "staff read active training videos" ON training_videos FOR SELECT
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('pos_user', 'delivery_driver', 'admin', 'super_admin')
    )
  );

CREATE TABLE IF NOT EXISTS staff_training_progress (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  video_id     UUID NOT NULL REFERENCES training_videos(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (staff_id, video_id)
);
ALTER TABLE staff_training_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff read own training progress" ON staff_training_progress;
CREATE POLICY "staff read own training progress" ON staff_training_progress FOR SELECT
  USING (staff_id = auth.uid());
