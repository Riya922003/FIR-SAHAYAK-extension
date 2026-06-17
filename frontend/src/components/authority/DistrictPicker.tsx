import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { setMyDistrict } from '../../api/auth';

export default function DistrictPicker() {
  const { token, updateUser } = useAuth();
  const [district, setDistrict] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !district.trim()) return;
    setLoading(true);
    setError('');
    try {
      const updated = await setMyDistrict(token, district.trim());
      updateUser({ district: updated.district });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to set district');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="district-picker-overlay">
      <div className="district-picker-card">
        <div className="district-picker-header">
          <div className="district-picker-icon">🏛️</div>
          <h2>Set Your District</h2>
          <p>
            As a Higher Authority, your portal is scoped to a single district.
            Enter your assigned district name to continue.
          </p>
        </div>

        {error && (
          <div className="dash-error" style={{ marginBottom: '1rem' }}>⚠ {error}</div>
        )}

        <form onSubmit={handleSubmit} className="district-picker-form">
          <div className="form-group-dash">
            <label>District Name</label>
            <input
              type="text"
              value={district}
              onChange={e => setDistrict(e.target.value)}
              placeholder="e.g. Gautam Buddha Nagar"
              required
              minLength={2}
              autoFocus
            />
          </div>
          <button
            type="submit"
            className="btn-primary"
            disabled={loading || !district.trim()}
            style={{ width: '100%' }}
          >
            {loading ? 'Saving…' : 'Confirm District →'}
          </button>
        </form>

        <p className="district-picker-hint">
          This can only be set once. Contact admin to change it.
        </p>
      </div>
    </div>
  );
}
