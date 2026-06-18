import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { setMyDistrict } from '../../api/auth';
import { getStationDistricts } from '../../api/fir';

export default function DistrictPicker() {
  const { token, updateUser } = useAuth();
  const [district, setDistrict] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [availableDistricts, setAvailableDistricts] = useState<string[]>([]);

  useEffect(() => {
    getStationDistricts().then(setAvailableDistricts).catch(() => {});
  }, []);

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
            Your portal is scoped to a single district. Select your assigned
            district from the list below.
          </p>
        </div>

        {error && (
          <div className="dash-error" style={{ marginBottom: '1rem' }}>⚠ {error}</div>
        )}

        <form onSubmit={handleSubmit} className="district-picker-form">
          <div className="form-group-dash">
            <label>District Name</label>

            {availableDistricts.length > 0 ? (
              <>
                {/* Dropdown for existing districts */}
                <select
                  value={district}
                  onChange={e => setDistrict(e.target.value)}
                  required
                  style={{
                    width: '100%', padding: '0.65rem 0.75rem',
                    border: '1px solid #e2e8f0', borderRadius: 8,
                    fontSize: '0.875rem', color: district ? '#0f172a' : '#94a3b8',
                    background: '#fff', cursor: 'pointer',
                  }}
                >
                  <option value="" disabled>— Select district —</option>
                  {availableDistricts.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0.4rem 0 0' }}>
                  {availableDistricts.length} district{availableDistricts.length !== 1 ? 's' : ''} with registered stations
                </p>
              </>
            ) : (
              /* Fallback: free text with datalist if API call fails or returns empty */
              <>
                <input
                  list="districts-list"
                  type="text"
                  value={district}
                  onChange={e => setDistrict(e.target.value)}
                  placeholder="Type or select a district"
                  required
                  minLength={2}
                  autoFocus
                />
                <datalist id="districts-list">
                  {availableDistricts.map(d => <option key={d} value={d} />)}
                </datalist>
              </>
            )}
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
