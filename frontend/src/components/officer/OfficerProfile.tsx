import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getStation } from '../../api/officer';

const ROLE_LABELS: Record<string, string> = {
  citizen:          'Citizen',
  officer:          'Police Officer',
  station_admin:    'Station Admin',
  higher_authority: 'Higher Authority',
};

interface Station {
  id: string;
  name: string;
  district: string;
  state: string;
  address: string;
  phone?: string;
}

export default function OfficerProfile() {
  const { user } = useAuth();
  const [station, setStation] = useState<Station | null>(null);
  const [stationLoading, setStationLoading] = useState(false);
  const [stationError, setStationError] = useState('');

  useEffect(() => {
    if (!user?.station_id) return;
    setStationLoading(true);
    getStation(user.station_id)
      .then(setStation)
      .catch(e => setStationError(e instanceof Error ? e.message : 'Failed to load station'))
      .finally(() => setStationLoading(false));
  }, [user?.station_id]);

  if (!user) return null;

  const initials = user.full_name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div>
      <div className="dash-header">
        <h1>My Profile</h1>
        <p>Your account and station information</p>
      </div>

      {/* Officer info */}
      <div className="dash-card profile-card">
        <div className="profile-avatar officer-avatar">{initials}</div>
        <div className="profile-name">{user.full_name}</div>
        <div className="profile-role-badge officer-role-badge">
          {ROLE_LABELS[user.role] ?? user.role}
        </div>

        <div className="profile-fields">
          <div className="profile-field">
            <label>Email Address</label>
            <span>{user.email}</span>
          </div>
          <div className="profile-field">
            <label>Username</label>
            <span>@{user.username}</span>
          </div>
          <div className="profile-field">
            <label>Phone</label>
            <span>{user.phone}</span>
          </div>
          <div className="profile-field">
            <label>Account Status</label>
            <span style={{ color: '#22c55e', fontWeight: 600 }}>✓ Active</span>
          </div>
        </div>
      </div>

      {/* Assigned station */}
      <div className="dash-card">
        <h2 className="section-label">Assigned Police Station</h2>

        {stationLoading && <div className="dash-loading">Loading station…</div>}
        {stationError && <div className="dash-error">⚠ {stationError}</div>}

        {!stationLoading && !stationError && !station && (
          <div style={{ color: '#64748b', fontSize: '0.875rem' }}>
            No station assigned yet.
          </div>
        )}

        {station && (
          <div className="station-info-card">
            <div className="station-info-icon">🏛</div>
            <div className="station-info-body">
              <div className="station-info-name">{station.name}</div>
              <div className="station-info-row">
                <span className="station-info-label">District</span>
                <span>{station.district}</span>
              </div>
              <div className="station-info-row">
                <span className="station-info-label">State</span>
                <span>{station.state}</span>
              </div>
              {station.address && (
                <div className="station-info-row">
                  <span className="station-info-label">Address</span>
                  <span>{station.address}</span>
                </div>
              )}
              {station.phone && (
                <div className="station-info-row">
                  <span className="station-info-label">Phone</span>
                  <span>{station.phone}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
