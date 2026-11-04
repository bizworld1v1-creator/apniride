/** Dates and money the way people in Pakistan read them, in Pakistan time whatever the server's zone. */
const dateTime = new Intl.DateTimeFormat('en-PK', {
  timeZone: 'Asia/Karachi',
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
});

export const when = (iso: string | null | undefined) => (iso ? dateTime.format(new Date(iso)) : '–');
export const rupees = (n: number) => `Rs ${n.toLocaleString('en-PK')}`;

export const RIDE_STATUS_LABELS: Record<string, string> = {
  searching: 'Searching',
  accepted: 'Driver coming',
  arrived: 'Driver arrived',
  in_progress: 'On trip',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_driver: 'No driver found',
};

export const DRIVER_STATUS_LABELS: Record<string, string> = {
  pending: 'Waiting for review',
  approved: 'Approved',
  rejected: 'Rejected',
  suspended: 'Suspended',
  incomplete: 'Registering',
};

export const DOCUMENT_LABELS: Record<string, string> = {
  selfie: 'Selfie',
  cnic_front: 'CNIC front',
  cnic_back: 'CNIC back',
  licence: 'Driving licence',
  vehicle_registration: 'Vehicle registration',
  vehicle_photo: 'Vehicle with plate',
  police_certificate: 'Police certificate',
};
