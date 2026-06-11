
-- Tracks table (shared catalog + user-added)
CREATE TABLE public.tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  country text NOT NULL,
  region text,
  length_m integer,
  direction text,
  corner_count integer,
  layout_notes text,
  gearing_notes text,
  brake_bias_start text,
  tyre_pressure_notes text,
  camber_toe_notes text,
  setup_tips text,
  weather_sensitivity text,
  is_seed boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tracks TO authenticated;
GRANT ALL ON public.tracks TO service_role;

ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in can read tracks"
  ON public.tracks FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can add tracks"
  ON public.tracks FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by AND is_seed = false);

CREATE POLICY "Users can update their own tracks"
  ON public.tracks FOR UPDATE TO authenticated
  USING (auth.uid() = created_by AND is_seed = false)
  WITH CHECK (auth.uid() = created_by AND is_seed = false);

CREATE POLICY "Users can delete their own tracks"
  ON public.tracks FOR DELETE TO authenticated
  USING (auth.uid() = created_by AND is_seed = false);

CREATE TRIGGER tracks_set_updated_at
  BEFORE UPDATE ON public.tracks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Per-user driver notes for a track
CREATE TABLE public.track_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id uuid NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.track_notes TO authenticated;
GRANT ALL ON public.track_notes TO service_role;

ALTER TABLE public.track_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own track notes"
  ON public.track_notes FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX track_notes_user_track_idx ON public.track_notes(user_id, track_id);

CREATE TRIGGER track_notes_set_updated_at
  BEFORE UPDATE ON public.track_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Attach tracks to sessions / calendar events
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS track_id uuid REFERENCES public.tracks(id) ON DELETE SET NULL;

ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS track_id uuid REFERENCES public.tracks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS sessions_track_id_idx ON public.sessions(track_id);
CREATE INDEX IF NOT EXISTS calendar_events_track_id_idx ON public.calendar_events(track_id);

-- Seed Australian tracks
INSERT INTO public.tracks (slug, name, country, region, length_m, direction, corner_count, layout_notes, gearing_notes, brake_bias_start, tyre_pressure_notes, camber_toe_notes, setup_tips, weather_sensitivity, is_seed)
VALUES
('queensland-raceway','Queensland Raceway','Australia','QLD',3120,'clockwise',6,
 'Flat, six-corner "paperclip" layout. Long back straight into a heavy stop at T1. Reward cars that ride kerbs at T3/T4 and rotate cleanly through the T5 hairpin.',
 'Top out 5th gear on the back straight; tall 2nd needed for T6 hairpin exit. Diff preload matters more than ratios on most cars.',
 '54% front (slight rear bias OK on locked-diff cars).',
 'Abrasive surface; drop hot pressures ~1–2 psi vs typical to avoid overheating fronts.',
 'Slightly more front camber (−3.0 to −3.5°) to protect the front-left through T3 & T6.',
 'Soften front roll bar to help rotation through slow corners; protect front tyres — they cook first.',
 'Low — surface drains quickly. Heat is the real enemy in summer.',
 true),

('morgan-park','Morgan Park Raceway','Australia','QLD',3000,'clockwise',11,
 'Technical, undulating layout near Warwick. Mix of slow hairpins and fast esses; kerb usage at the chicane is critical.',
 'Short shifting in mid corners pays off; 3rd gear used a lot.',
 '55% front to help slow the car under late braking into the hairpins.',
 'Cool ambient often — start 1 psi above your usual hot target.',
 'Symmetric camber, more toe-out front for turn-in into slow corners.',
 'Mechanical grip dominates. Soft springs, plenty of bump travel.',
 'Medium — exposed paddock, wind can change brake markers.',
 true),

('lakeside-park','Lakeside Park','Australia','QLD',2410,'clockwise',9,
 'Short, fast and old-school. Karousel and Eastern Loop reward commitment. Bumpy in places — compliance over stiffness.',
 'Gears clustered; 3rd–4th do most of the work.',
 '53% front — avoid locking rears into the Karousel.',
 'Heat builds quickly on the short lap; start 2 psi under target.',
 'More front camber (−3.5°) for sustained high-load left-handers.',
 'Run a compliant rear; Karousel exit traction wins lap time.',
 'High — track gets very greasy in light rain due to age of surface.',
 true),

('sydney-motorsport-park','Sydney Motorsport Park (Gardner GP)','Australia','NSW',3930,'clockwise',12,
 'Flowing GP layout. Big stop at T2, fast right-hander at T6, technical infield. Reward cars with strong front end and stable rear under brakes.',
 '5th gear on the main straight; 2nd for the slowest infield right.',
 '55% front initially, bias rearward as fuel burns off in enduros.',
 'Surface is grippy; pressures climb fast — set 2 psi below target cold.',
 '−3.0° front camber, 0.2° toe-out front, 0.1° toe-in rear.',
 'Aero balance matters — don''t over-wing the rear or T6 understeers.',
 'Medium — drains well but T1 collects standing water in heavy rain.',
 true),

('winton-motor-raceway','Winton Motor Raceway','Australia','VIC',3000,'anticlockwise',12,
 'Tight, twisty, anticlockwise. Loads up the right-front tyre relentlessly. Bumpy entries; needs a compliant car.',
 'Low gears dominate; 4th is the highest used on most cars.',
 '56% front — heavy trail braking through T1, T3 and the sweeper.',
 'Drop right-side pressures 1–2 psi cold; they''ll equalise hot.',
 'Asymmetric camber: more negative on the right (−3.5° RF, −3.0° LF) to handle the loading.',
 'Soft front anti-roll bar and progressive rear to help rotation. Don''t over-stiffen.',
 'Medium — surface gets slick in light rain but dries quickly.',
 true),

('sandown','Sandown International Raceway','Australia','VIC',3104,'clockwise',13,
 'Two long straights joined by a slow infield. Heavy braking zones at T1 and T6. Smooth surface but kerb damage at chicane is real.',
 'Tall 5th/6th on the straights; 2nd into Dandenong Road hairpin.',
 '55% front — protect rears under big stops, especially in cooler conditions.',
 'Pressures rise on the straights; start 1–2 psi below target.',
 'Standard −3.0° front, −2.5° rear. Toe-out front 0.2°.',
 'Stable rear under brakes is everything. Don''t chase infield rotation at the cost of straight-line stability.',
 'High — Melbourne weather; track temp swings 15°C+ across a day.',
 true),

('phillip-island','Phillip Island Grand Prix Circuit','Australia','VIC',4445,'anticlockwise',12,
 'Fast, flowing, coastal. Lukey Heights and Siberia are sustained high-load left-handers — eat front-left tyres alive. Iconic T1 (Doohan) is flat in most categories.',
 'Long gears — 6th used; never below 3rd.',
 '54% front — the car is rarely in slow corners.',
 'Run higher pressures than usual (2–3 psi above typical) to keep fronts from rolling onto the sidewall in sustained loads.',
 'Aggressive front-left camber (−3.5° to −4.0°). Watch tyre temps after Lukey.',
 'Aero balance and tyre management dominate. Don''t under-tyre the front-left.',
 'Very high — coastal, wind shifts brake markers; rain can arrive in minutes.',
 true),

('the-bend','The Bend Motorsport Park (International)','Australia','SA',4950,'clockwise',18,
 'Modern, smooth and wide. International layout has long straights and a technical infield. Multiple lines through most corners — rewards experimentation.',
 'Top gear on the main straight; close ratios help on the infield.',
 '55% front to settle the car into the heavy T1 and T6 stops.',
 'Smooth surface = lower wear; start at typical pressures and tune from there.',
 '−3.0° front camber baseline. Symmetrical setup works.',
 'Plenty of grip — bias setup toward mid-corner rotation; understeer is easy to dial in here.',
 'Low — surface drains well, but Tailem Bend gets hot in summer.',
 true),

('hidden-valley','Hidden Valley Raceway','Australia','NT',2870,'clockwise',14,
 'Tropical Darwin circuit. Long back straight, twisty infield. Tarmac runs hot — tyre management is the lap.',
 'Tall top gear for the back straight; 2nd used for the slowest infield corner.',
 '54% front; the heat reduces rear grip first.',
 'Drop hot target by 3 psi vs usual — track temps regularly exceed 50°C.',
 '−3.0° front, −2.5° rear. Don''t over-camber — heat will already overwork the inside shoulder.',
 'Cool the brakes; ducting is mandatory. Choose tyre compound conservatively.',
 'High — wet season storms; track goes from dry to flooded in an hour.',
 true),

('bathurst','Mount Panorama (Bathurst)','Australia','NSW',6213,'anticlockwise',23,
 'The Mountain. Long straights bookending a narrow, undulating, fast mountain section across the top (Skyline → The Esses → Forrest''s Elbow). Walls everywhere — commitment and stability rule.',
 '6th gear down Conrod; 2nd for Murray''s Corner. Gear spread matters: don''t leave a hole between 4th and 5th over the top.',
 '56% front for the Chase and T1; ease rearward in qualifying trim.',
 'Big temp swings across the lap (cool over the mountain, hot on Conrod). Set toward the hot end.',
 '−3.0° front, −2.5° rear. Toe-in rear 0.15° for high-speed stability.',
 'Stability over the mountain beats outright cornering pace. Ride height clearance through The Dipper is critical.',
 'Very high — altitude weather; fog, rain and sun within one session is normal.',
 true);
