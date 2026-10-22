// Raw source types matching the OXO delivery envelope format

export interface CallPayload {
  id: string;
  external_call_id: string;
  workspace_slug: string;
  rep_email: string | null;
  rep_name: string | null;
  rep_user_id: string | null;
  direction: 'inbound' | 'outbound';
  direction_raw: string;
  from_number: string | null;
  to_number: string | null;
  started_at: string;
  duration_seconds: number;
  talk_time_seconds: number | null;
  speaker_count: number | null;
  segment_count: number | null;
  is_connected: boolean | null;
  is_conversation: boolean | null;
  observed_outcome: string | null;
  classification_reason: null;
  classification_status: string | null;
  is_campaign_call: boolean | null;
  first_dial_ever: boolean | null;
  first_connect_ever: boolean | null;
  prior_dials_ever: number | null;
  prior_connects_ever: number | null;
  summary: null;
  summary_status: string | null;
  transcript: string | null;
}

export interface MeetingPayload {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  duration_seconds: number;
  provider: string;
  join_url: string;
  organizer_email: string | null;
  attendee_count: number | null;
  recording_status: 'recorded' | 'cancelled' | 'not_scheduled';
  recording_detail: string | null;
  recording_id: string | null;
  has_transcript: boolean;
  has_video: boolean;
  summary: null;
  summary_status: string | null;
  redacted: boolean;
}

export interface TranscriptTurn {
  speaker: string;
  starts_at_seconds: number;
  timecode: string;
  text: string;
}

export interface TranscriptPayload {
  meeting_id: string;
  turns: TranscriptTurn[];
  unavailable_reason: string | null;
}

export interface EnvelopeRecord {
  record_ref: string;
  source_type: 'call' | 'meeting';
  source_id: string;
  payload: CallPayload | MeetingPayload;
  transcript_payload: TranscriptPayload | null;
}

export interface DeliveryEnvelope {
  batch_id: string;
  revision: number;
  exported_at: string;
  records: EnvelopeRecord[];
}
