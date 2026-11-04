import { DRIVER_DOCUMENT_TYPES, formatCnic, formatDate, REQUIRED_DRIVER_DOCUMENTS } from '@apniride/shared';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DOCUMENT_LABELS, DRIVER_STATUS_LABELS, when } from '@/lib/format';
import { load } from '@/lib/session';
import { ReviewForm } from './ReviewForm';

const ACTION_LABELS: Record<string, string> = {
  'driver.approve': 'approved',
  'driver.reject': 'rejected',
  'driver.suspend': 'suspended',
};

export default async function DriverPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const d = await load((api) => api.admin.driver(id));
  const uploaded = new Map(d.documents.map((doc) => [doc.type, doc]));
  const v = d.details?.vehicle;

  return (
    <>
      <p>
        <Link href={`/drivers?status=${d.status}`}>‹ {DRIVER_STATUS_LABELS[d.status]}</Link>
      </p>
      <h1>
        {d.name ?? '(no name)'} <span className={`badge ${d.status}`}>{DRIVER_STATUS_LABELS[d.status]}</span>
      </h1>
      {d.reviewNote ? <p className="note">Reason given: {d.reviewNote}</p> : null}

      <section className="columns">
        <div>
          <h2>Details</h2>
          <table>
            <tbody>
              <tr><th>Phone</th><td>{d.phone}</td></tr>
              <tr><th>Gender</th><td>{d.gender ?? '–'}</td></tr>
              {d.details ? (
                <>
                  <tr>
                    <th>CNIC</th>
                    <td>
                      {formatCnic(d.details.cnic)}
                      {d.cnicGenderMatches === false ? (
                        <div className="warn">
                          The CNIC&apos;s last digit says {d.gender === 'female' ? 'male' : 'female'}. Check the card closely.
                        </div>
                      ) : null}
                    </td>
                  </tr>
                  <tr><th>Licence</th><td>{d.details.licenceNumber}, valid until {formatDate(d.details.licenceExpiry)}</td></tr>
                  <tr><th>Vehicle</th><td>{v!.type === 'car' ? 'Car (AC)' : 'Bike'}: {v!.make} {v!.model} {v!.year}, {v!.colour}</td></tr>
                  <tr><th>Number plate</th><td><strong>{v!.plate}</strong></td></tr>
                </>
              ) : (
                <tr><th>Details</th><td className="muted">Not filled in yet</td></tr>
              )}
              <tr><th>Signed up</th><td>{when(d.createdAt)}</td></tr>
              <tr><th>Sent for review</th><td>{when(d.submittedAt)}</td></tr>
            </tbody>
          </table>
        </div>
        <div>
          <h2>Decision</h2>
          <p className="muted">Check: photo matches selfie, CNIC and licence names match, licence valid, plate on the photo matches.</p>
          <ReviewForm id={d.id} status={d.status} />
          {d.history.length ? (
            <>
              <h3>History</h3>
              <ul className="history">
                {d.history.map((h, i) => (
                  <li key={i}>
                    {when(h.at)}: {h.adminName ?? 'An admin'} {ACTION_LABELS[h.action] ?? h.action}
                    {typeof h.details.reason === 'string' ? ` (“${h.details.reason}”)` : ''}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      </section>

      <h2>Documents</h2>
      <p className="muted">Personal documents: don&apos;t download or share them. Click a photo to open it full size.</p>
      <div className="photos">
        {DRIVER_DOCUMENT_TYPES.map((type) => {
          const doc = uploaded.get(type);
          const src = `/api/documents/${d.id}/${type}?v=${encodeURIComponent(doc?.uploadedAt ?? '')}`;
          return (
            <figure key={type}>
              {doc ? (
                <a href={src} target="_blank" rel="noreferrer">
                  {/* Plain <img>: these must never go through Next's image cache. */}
                  <img src={src} alt={DOCUMENT_LABELS[type]} loading="lazy" />
                </a>
              ) : (
                <div className="missing">
                  {REQUIRED_DRIVER_DOCUMENTS.includes(type) ? 'Missing (required)' : 'Not uploaded (optional)'}
                </div>
              )}
              <figcaption>
                {DOCUMENT_LABELS[type]}
                {doc ? <span className="muted"> · {when(doc.uploadedAt)}</span> : null}
              </figcaption>
            </figure>
          );
        })}
      </div>
    </>
  );
}
