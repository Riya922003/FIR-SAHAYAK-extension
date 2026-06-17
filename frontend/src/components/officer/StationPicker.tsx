import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getNearbyStations, type PoliceStation } from '../../api/fir';
import { setMyStation } from '../../api/auth';

export default function StationPicker() {
  const { token, updateUser } = useAuth();

  const [address, setAddress] = useState('');
  const [stations, setStations] = useState<PoliceStation[]>([]);
  const [selected, setSelected] = useState<PoliceStation | null>(null);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [saveError, setSaveError] = useState('');

  const handleSearch = async () => {
    if (!address.trim()) return;
    setSearching(true);
    setSearchError('');
    setStations([]);
    setSelected(null);
    try {
      const results = await getNearbyStations(address.trim());
      setStations(results);
      if (results.length === 0) setSearchError('No stations found. Try a nearby landmark or area name.');
    } catch (e: unknown) {
      setSearchError(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  const handleConfirm = async () => {
    if (!token || !selected) return;
    setSaving(true);
    setSaveError('');
    try {
      const updatedUser = await setMyStation(token, selected.id);
      updateUser({ station_id: updatedUser.station_id });
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save station');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="station-picker-overlay">
      <div className="station-picker-card">
        <div className="station-picker-header">
          <h2>Set Your Station</h2>
          <p>Search for the police station you are assigned to. This only needs to be done once.</p>
        </div>

        {/* Search box */}
        <div className="station-picker-search">
          <input
            type="text"
            value={address}
            onChange={e => setAddress(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="Enter your station's area or address…"
            className="officer-input"
          />
          <button
            className="btn-acknowledge"
            onClick={handleSearch}
            disabled={searching || !address.trim()}
          >
            {searching ? 'Searching…' : 'Search'}
          </button>
        </div>

        {searchError && <div className="dash-error" style={{ marginTop: '0.75rem' }}>⚠ {searchError}</div>}

        {/* Station list */}
        {stations.length > 0 && !selected && (
          <div className="station-picker-list">
            {stations.map(s => (
              <button
                key={s.id}
                className="station-picker-item"
                onClick={() => setSelected(s)}
              >
                <div className="station-picker-name">{s.name}</div>
                <div className="station-picker-meta">{s.district}, {s.state}</div>
                {s.address && <div className="station-picker-addr">{s.address}</div>}
              </button>
            ))}
          </div>
        )}

        {/* Selected station confirmation */}
        {selected && (
          <div className="station-picker-confirm">
            <div className="station-picker-selected">
              <span className="station-selected-check">✓</span>
              <div>
                <div className="station-picker-name">{selected.name}</div>
                <div className="station-picker-meta">{selected.district}, {selected.state}</div>
              </div>
              <button
                className="btn-secondary"
                style={{ marginLeft: 'auto', fontSize: '0.8rem', padding: '0.3rem 0.8rem' }}
                onClick={() => setSelected(null)}
              >
                Change
              </button>
            </div>

            {saveError && <div className="dash-error" style={{ margin: '0.75rem 0 0' }}>⚠ {saveError}</div>}

            <button
              className="btn-status-submit"
              style={{ marginTop: '1rem', width: '100%' }}
              onClick={handleConfirm}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Confirm — This is my station'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
