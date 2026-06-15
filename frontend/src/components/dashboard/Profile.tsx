import { useAuth } from '../../context/AuthContext';

const ROLE_LABELS: Record<string, string> = {
  CITIZEN: 'Citizen',
  OFFICER: 'Police Officer',
  STATION_ADMIN: 'Station Admin',
  HIGHER_AUTHORITY: 'Higher Authority',
};

export default function Profile() {
  const { user } = useAuth();
  if (!user) return null;

  const initials = user.full_name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="dash-card profile-card">
      <div className="profile-avatar">{initials}</div>
      <div className="profile-name">{user.full_name}</div>
      <div className="profile-role-badge">{ROLE_LABELS[user.role] || user.role}</div>

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
  );
}
