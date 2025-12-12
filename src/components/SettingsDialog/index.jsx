import { Dialog } from 'primereact/dialog';
import { InputSwitch } from 'primereact/inputswitch';
import { useSettings } from '../../providers/SettingsProvider';
import PropTypes from 'prop-types';

export default function SettingsDialog({ visible, onHide }) {
  const { settings, updateSettings } = useSettings();

  const handleReplayFeaturesToggle = (checked) => {
    updateSettings({ replayFeaturesEnabled: checked });
  };

  return (
    <Dialog
      header="Settings"
      visible={visible}
      onHide={onHide}
      style={{ width: '450px' }}
      footer={
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button
            className="p-button p-component p-button-text"
            onClick={onHide}
            style={{ padding: '0.5rem 1rem' }}
          >
            Close
          </button>
        </div>
      }
    >
      <div style={{ padding: '1rem 0', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <label htmlFor="replayFeatures" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              Enable Replay Features
            </label>
            <small style={{ display: 'block', color: 'var(--text-color-secondary)' }}>
              Enable advanced sort orders (Oldest First, Newest First, Date/Time, Message ID) that require Replay and temporary queues
            </small>
          </div>
          <InputSwitch
            id="replayFeatures"
            checked={settings.replayFeaturesEnabled}
            onChange={(e) => handleReplayFeaturesToggle(e.value)}
          />
        </div>
      </div>
    </Dialog>
  );
}

SettingsDialog.propTypes = {
  visible: PropTypes.bool.isRequired,
  onHide: PropTypes.func.isRequired
};

