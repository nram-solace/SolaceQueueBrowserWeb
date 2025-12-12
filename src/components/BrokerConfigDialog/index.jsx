import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Toolbar } from 'primereact/toolbar';
import { FloatLabel } from 'primereact/floatlabel';
import { InputText } from 'primereact/inputtext'
import { Password } from 'primereact/password';
import { Checkbox } from 'primereact/checkbox';
import { Dropdown } from 'primereact/dropdown';
import { MultiSelect } from 'primereact/multiselect';
import { Toast } from 'primereact/toast'

import classes from './styles.module.css';
import { useEffect, useState, useRef } from 'react';
import { useSempApi } from '../../providers/SempClientProvider';
import solace from '../../utils/solace/solclientasync';
import { showErrorToast, showSuccessToast, showToast } from '../../utils/toast';
import PropTypes from 'prop-types';
        
export default function BrokerConfigDialog( { config, brokerEditor, onHide }) {
  const visible = (config !== null);
  const [values, setValues] = useState({});
  const toast = useRef(null);
  const sempApi = useSempApi();

  // Detect if this is edit mode (existing broker) or new broker
  const isEditMode = config && config.id && config.id !== 0;
  
  // State for new brokers (single page)
  const [vpnList, setVpnList] = useState([]);
  const [selectedVpns, setSelectedVpns] = useState([]);
  const [isLoadingVpns, setIsLoadingVpns] = useState(false);
  const [vpnsLoaded, setVpnsLoaded] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  // Environment and Type options
  const environmentOptions = [
    { label: 'LAB', value: 'LAB' },
    { label: 'POC', value: 'POC' },
    { label: 'DEV', value: 'DEV' },
    { label: 'UAT', value: 'UAT' },
    { label: 'SIT', value: 'SIT' },
    { label: 'PROD', value: 'PROD' },
    { label: 'DR', value: 'DR' },
    { label: 'Other', value: 'Other' }
  ];

  const typeOptions = [
    { label: 'Solace Cloud', value: 'Solace Cloud' },
    { label: 'AEM', value: 'AEM' },
    { label: 'Software', value: 'Software' },
    { label: 'Appliance', value: 'Appliance' },
    { label: 'Generic', value: 'Generic' }
  ];

  useEffect(() => {
    if (isEditMode) {
      // Edit mode: initialize with config values, extract name from displayName
      const displayNameParts = config?.displayName ? config.displayName.split(':') : [];
      const brokerName = displayNameParts.length > 1 ? displayNameParts[0] : '';
      
      setValues({
        id: 0,
        name: brokerName,
        displayName: '',
        hostName: '',
        messagingHost: config?.messagingHost || config?.hostName || '',
        clientPort: '',
        sempPort: '',
        useTls: false,
        sempUseTls: false,
        vpn: '',
        clientUsername: '',
        clientPassword: '',
        sempUsername: '',
        sempPassword: '',
        environment: 'Other',
        region: null,
        type: 'Generic',
        label: '',
        ...(config || {})
      });
    } else {
      // New broker: initialize single page form
      setValues({
        id: 0,
        name: '',
        hostName: '',
        messagingHost: '',
        sempPort: '943',
        sempUseTls: true,
        sempUsername: '',
        sempPassword: '',
        environment: 'Other',
        region: null,
        type: 'Generic',
        clientPort: '443',
        useTls: true,
        clientUsername: '',
        clientPassword: ''
      });
      setSelectedVpns([]);
      setVpnList([]);
      setVpnsLoaded(false);
    }
  }, [config, isEditMode]);

  const handleInputChange = (evt) => {
    setValues({ ...values, [evt.target.id] : 
      (evt.target.type === 'checkbox') ? 
        evt.target.checked :
        evt.target.value 
    });
  };

  const handleDropdownChange = (field, value) => {
    setValues({ ...values, [field]: value });
  };

  // Handle messaging host change - copy from hostname if empty
  const handleMessagingHostChange = (e) => {
    setValues({ ...values, messagingHost: e.target.value });
  };

  // Handle hostname change - update messaging host if it matches
  const handleHostNameChange = (e) => {
    const newHostName = e.target.value;
    const newValues = { ...values, hostName: newHostName };
    // If messaging host is empty or matches old hostname, update it
    if (!values.messagingHost || values.messagingHost === values.hostName) {
      newValues.messagingHost = newHostName;
    }
    setValues(newValues);
  };

  // Get VPNs from broker (refresh VPN list)
  const handleGetVpns = async () => {
    // Validate required fields
    if (!values.hostName || !values.sempPort || !values.sempUsername || !values.sempPassword) {
      showErrorToast(toast, 'Please fill in Management (SEMP) hostname, port, username and password to fetch VPNs.', 'Validation Error', 3000);
      return;
    }

    // Validate port is numeric
    if (isNaN(parseInt(values.sempPort))) {
      showErrorToast(toast, 'SEMP Port must be a number.', 'Validation Error', 3000);
      return;
    }

    await fetchVpns(values);
  };

  // Fetch VPNs from broker
  const fetchVpns = async (step1Data) => {
    setIsLoadingVpns(true);
    try {
      const sempClient = sempApi.getClient({
        hostName: step1Data.hostName,
        sempPort: step1Data.sempPort,
        sempUseTls: step1Data.sempUseTls,
        sempUsername: step1Data.sempUsername,
        sempPassword: step1Data.sempPassword
      });

      const { response } = await sempClient.getMsgVpnsWithHttpInfo({ count: 100 });
      
      if (response.status === 200 && response.body?.data) {
        const vpns = response.body.data.map(vpn => vpn.msgVpnName);
        setVpnList(vpns);
        setVpnsLoaded(true);
      } else {
        showErrorToast(toast, 'Failed to fetch VPNs from broker.', 'Error', 3000);
        setVpnList([]);
      }
    } catch (err) {
      console.error('Error fetching VPNs:', err);
        showErrorToast(toast, 'Failed to fetch VPNs from broker.', 'Error', 3000);
        setVpnList([]);
    } finally {
      setIsLoadingVpns(false);
    }
  };

  // Test WebSocket connection for a VPN
  const testWebSocketConnection = async (vpnName) => {
    const hostName = values.messagingHost || values.hostName;
    const url = `${(values.useTls ? 'wss' : 'ws')}://${hostName}:${values.clientPort}`;
    
    try {
      const session = solace.SolclientFactory.createAsyncSession({
        url: url,
        vpnName: vpnName,
        userName: values.clientUsername,
        password: values.clientPassword,
        reconnectRetries: 0,
        connectRetries: 0
      });
      await session.connect();
      session.disconnect();
      return { success: true, vpnName };
    } catch (err) {
      console.error('WebSocket connection error details:', {
        message: err.message,
        toString: err.toString(),
        responseCode: err.responseCode,
        info: err.info,
        str: err.str,
        fullError: err
      });
      
      let errorMessage = 'Unknown connection error';
      if (err.responseCode) {
        switch(err.responseCode) {
          case 401:
            errorMessage = 'Incorrect client username or password.';
            break;
          default:
            errorMessage = `Connection failed with code ${err.responseCode}.`;
        }
      } else {
        const errMsg = err.message || err.toString() || err.str || '';
        const errStr = errMsg.toLowerCase();
        const errInfo = err.info || {};
        const errInfoStr = JSON.stringify(errInfo).toLowerCase();
        
        // Check for certificate/SSL errors in message or info
        const isCertError = errStr.includes('certificate') || 
            errStr.includes('ssl') || 
            errStr.includes('tls') ||
            errStr.includes('cert') ||
            errStr.includes('untrusted') ||
            errStr.includes('invalid certificate') ||
            errStr.includes('certificate verify failed') ||
            errStr.includes('certificate chain') ||
            errStr.includes('self-signed') ||
            errStr.includes('sec_error') ||
            errInfoStr.includes('certificate') ||
            errInfoStr.includes('ssl') ||
            errInfoStr.includes('tls');
        
        if (isCertError) {
          const brokerUrl = `https://${hostName}:${values.clientPort}`;
          errorMessage = `SSL/TLS certificate validation failed. To accept the certificate:\n\n1. Open this URL in your browser: ${brokerUrl}\n2. If you see a certificate warning, click "Advanced" and then "Proceed" or "Accept the Risk"\n3. This will add the certificate to your browser's trusted store\n4. Try connecting again\n\nNote: WebSocket connections don't show certificate prompts, so you must accept the certificate via a regular HTTPS page first.`;
        } else if (errMsg.includes('invalid URL')) {
          errorMessage = 'Invalid broker URL.';
        } else if (errMsg.includes('Connection error') || errMsg.includes('NetworkError')) {
          // For generic connection errors, suggest certificate acceptance
          const brokerUrl = `https://${hostName}:${values.clientPort}`;
          errorMessage = `Unable to connect to broker. This may be a certificate issue.\n\nTry opening ${brokerUrl} in your browser first to accept the certificate, then try connecting again.`;
        } else if (errMsg.includes('timeout')) {
          errorMessage = 'Connection timeout. Please check the hostname and port.';
        } else {
          errorMessage = errMsg || 'Connection failed.';
        }
      }
      
      return { success: false, vpnName, error: errorMessage };
    }
  };

  // Test WebSocket connection for all selected VPNs
  const handleTestConnection = async () => {
    // Validate required fields
    if (!values.messagingHost && !values.hostName) {
      showErrorToast(toast, 'Please fill in Messaging (SMF) Host or IP.', 'Validation Error', 3000);
      return;
    }

    if (!values.clientPort || !values.clientUsername || !values.clientPassword) {
      showErrorToast(toast, 'Please fill in Websocket Port, Client Username and Password.', 'Validation Error', 3000);
      return;
    }

    // Validate port is numeric
    if (isNaN(parseInt(values.clientPort))) {
      showErrorToast(toast, 'Websocket Port must be a number.', 'Validation Error', 3000);
      return;
    }

    // Validate at least one VPN selected
    if (!selectedVpns || selectedVpns.length === 0) {
      showErrorToast(toast, 'Please select at least one VPN to test.', 'Validation Error', 3000);
      return;
    }

    setIsTestingConnection(true);
    const hostName = values.messagingHost || values.hostName;
    const protocol = values.useTls ? 'WSS' : 'WS';
    
    try {
      const connectionResults = await Promise.all(
        selectedVpns.map(vpnName => testWebSocketConnection(vpnName))
      );

      // Check if any connections failed
      const failedConnections = connectionResults.filter(result => !result.success);
      const successfulConnections = connectionResults.filter(result => result.success);
      
      if (failedConnections.length > 0) {
        // Show error for failed connections
        const errorDetails = failedConnections.map(f => 
          `${f.vpnName}: ${f.error}`
        ).join('\n');
        
        let detailMessage = `Connection test results:\n\n`;
        if (successfulConnections.length > 0) {
          detailMessage += `✓ Passed (${successfulConnections.length}): ${successfulConnections.map(s => s.vpnName).join(', ')}\n\n`;
        }
        detailMessage += `✗ Failed (${failedConnections.length}):\n${errorDetails}\n\nPlease check the messaging host, port, credentials, and VPN access.`;
        
        showErrorToast(toast, detailMessage, `${protocol} Connection Test Results`, 10000);
      } else {
        // All connections succeeded
        showSuccessToast(
          toast,
          `All ${selectedVpns.length} VPN connection${selectedVpns.length === 1 ? '' : 's'} tested successfully:\n${selectedVpns.join(', ')}`,
          'Broker connection successful',
          5000
        );
      }
    } catch (err) {
      console.error('Error during connection test:', err);
      showErrorToast(toast, 'An unexpected error occurred during connection testing. Please try again.', 'Connection Test Error');
    } finally {
      setIsTestingConnection(false);
    }
  };

  // Save broker entries for selected VPNs (without testing)
  const handleSave = () => {
    // Validate Step 1 required fields
    if (!values.name || !values.hostName || !values.sempPort || !values.sempUsername || !values.sempPassword) {
      showErrorToast(toast, 'Please fill in all required Step 1 fields.', 'Validation Error', 3000);
      return;
    }

    // Validate Step 2 required fields
    if (!values.clientPort || !values.clientUsername || !values.clientPassword) {
      showErrorToast(toast, 'Please fill in all required Step 2 fields.', 'Validation Error', 3000);
      return;
    }

    // Validate ports are numeric
    if (isNaN(parseInt(values.sempPort))) {
      showErrorToast(toast, 'SEMP Port must be a number.', 'Validation Error', 3000);
      return;
    }

    if (isNaN(parseInt(values.clientPort))) {
      showErrorToast(toast, 'Websocket Port must be a number.', 'Validation Error', 3000);
      return;
    }

    // Validate at least one VPN selected
    if (!selectedVpns || selectedVpns.length === 0) {
      showErrorToast(toast, 'Please select at least one VPN.', 'Validation Error', 3000);
      return;
    }

    // Create broker entry for each selected VPN
    const hostName = values.messagingHost || values.hostName;
    selectedVpns.forEach((vpnName, index) => {
      const brokerConfig = {
        id: Date.now() + index, // Ensure uniqueness
        displayName: `${values.name}:${vpnName}`,
        hostName: hostName,
        clientPort: values.clientPort,
        sempPort: values.sempPort,
        sempUseTls: values.sempUseTls,
        useTls: values.useTls,
        vpn: vpnName,
        clientUsername: values.clientUsername,
        clientPassword: values.clientPassword,
        sempUsername: values.sempUsername,
        sempPassword: values.sempPassword,
        environment: values.environment,
        region: values.region || null,
        type: values.type
      };
      brokerEditor.save(brokerConfig);
    });

    // Show success message
    showSuccessToast(toast, `Created ${selectedVpns.length} broker entr${selectedVpns.length === 1 ? 'y' : 'ies'}.`);

    // Close dialog
    onHide?.();
  };

  const handleSaveEdit = () => {
    // Ensure displayName is properly constructed from name and vpn
    const updatedValues = { ...values };
    if (updatedValues.name && updatedValues.vpn) {
      updatedValues.displayName = `${updatedValues.name}:${updatedValues.vpn}`;
    } else if (updatedValues.displayName && !updatedValues.name && !updatedValues.vpn) {
      // If displayName exists but name/vpn don't, try to extract them
      const parts = updatedValues.displayName.split(':');
      if (parts.length > 1) {
        updatedValues.name = parts[0];
        updatedValues.vpn = parts[1];
      }
    }
    brokerEditor.save(updatedValues);
    onHide?.();
  };

  const handleDelete = () => {
    brokerEditor.delete(values);
    onHide?.();
  };

  const handleHide = () => {
    onHide?.();
  }

  const handleTestConnectionEdit = async () => {
    const { message } = await brokerEditor.test(values);
    showToast(toast, message);
  }

  const Header = () => {
    if (!visible) return null;
    if (isEditMode) {
      return <>Edit Broker</>;
    }
    return <>Add Solace Event Broker and services (VPNs)</>;
  };

  const Footer = () => {
    if (isEditMode) {
      // Edit mode: existing footer
      return (
    <Toolbar
      start={
            <Button severity="danger" onClick={handleDelete}>Delete</Button>
      } 
      end={
        <>
          <Button outlined severity="secondary" onClick={handleTestConnectionEdit}>Test Connection</Button>
          <Button onClick={handleSaveEdit}>Save</Button>
        </>
      }
    />
  );
    }
    
    // New broker: single page footer
    return (
      <Toolbar
        end={
          <>
            <Button outlined severity="secondary" onClick={handleHide}>Cancel</Button>
            <Button 
              onClick={handleGetVpns} 
              loading={isLoadingVpns} 
              disabled={isLoadingVpns || isTestingConnection || !values.hostName || !values.sempPort || !values.sempUsername || !values.sempPassword}
              outlined
              severity="secondary"
            >
              Get VPNs
            </Button>
            <Button 
              onClick={handleTestConnection} 
              loading={isTestingConnection} 
              disabled={isTestingConnection || selectedVpns.length === 0 || !values.messagingHost && !values.hostName || !values.clientPort || !values.clientUsername || !values.clientPassword}
              outlined
              severity="secondary"
            >
              Test Connection
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={isLoadingVpns || isTestingConnection || selectedVpns.length === 0}
            >
              Save
            </Button>
          </>
        }
      />
    );
  };
  // Toggle VPN selection
  const handleVpnToggle = (vpnName) => {
    setSelectedVpns(prev => 
      prev.includes(vpnName) 
        ? prev.filter(v => v !== vpnName)
        : [...prev, vpnName]
    );
  };

  // Render new broker form (single page)
  const renderNewBrokerForm = () => (
    <form autoComplete="off">
      <div className={classes.mainLayout}>
        {/* Left Column: All Form Fields */}
        <div className={classes.leftColumn}>
          {/* Name field */}
          <div style={{marginBottom: '1rem'}}>
            <label htmlFor="name" className={classes.fieldLabel}>Name</label>
            <InputText 
              id="name" 
              className={classes.formInput} 
              value={values.name || ''} 
              onChange={handleInputChange}
              disabled={isLoadingVpns || isTestingConnection}
              style={{maxWidth: '300px'}}
            />
          </div>

          {/* Step 1 Section */}
          <div>
        {/* Row 1: Management (SEMP) Hostname or IP, Port, TLS */}
        <div style={{display:'flex', gap: '0.6rem', marginBottom: '1rem'}}>
          <div style={{flex: 1}}>
            <label htmlFor="hostName" className={classes.fieldLabel}>Management (SEMP) Hostname or IP</label>
            <InputText 
              id="hostName" 
              className={classes.formInput} 
              value={values.hostName || ''} 
              onChange={handleHostNameChange}
              disabled={isLoadingVpns || isTestingConnection}
            />
          </div>
          <div style={{flex: '0 0 120px'}}>
            <label htmlFor="sempPort" className={classes.fieldLabel}>Port</label>
            <InputText 
              id="sempPort" 
              className={classes.formInput} 
              value={values.sempPort || ''} 
              onChange={handleInputChange}
              disabled={isLoadingVpns || isTestingConnection}
            />
          </div>
          <div style={{flex: '0 0 80px', display: 'flex', flexDirection: 'column'}}>
            <label htmlFor="sempUseTls" className={classes.fieldLabel}>TLS</label>
            <div style={{display: 'flex', alignItems: 'center', height: '2.5rem'}}>
              <Checkbox 
                id="sempUseTls" 
                onChange={handleInputChange} 
                checked={values.sempUseTls !== false} 
                disabled={isLoadingVpns || isTestingConnection}
              />
            </div>
          </div>
        </div>

        {/* Row 2: Management (SEMP) Username, Password */}
        <div style={{display:'flex', gap: '0.6rem', marginBottom: '1rem'}}>
          <div style={{flex: '0 0 300px'}}>
            <label htmlFor="sempUsername" className={classes.fieldLabel}>Management (SEMP) Username</label>
            <InputText 
              id="sempUsername" 
              className={classes.formInput} 
              value={values.sempUsername || ''} 
              onChange={handleInputChange}
              disabled={isLoadingVpns || isTestingConnection}
            />
          </div>
          <div style={{flex: 1}}>
            <label htmlFor="sempPassword" className={classes.fieldLabel}>Password</label>
            <Password 
              inputId="sempPassword" 
              className={classes.passwordInput} 
              feedback={false} 
              value={values.sempPassword || ''} 
              onChange={handleInputChange}
              disabled={isLoadingVpns || isTestingConnection}
            />
          </div>
        </div>

        {/* Row 3: ENV | Region | Type */}
        <div style={{display:'flex', gap: '0.6rem', marginBottom: '1rem'}}>
          <div style={{flex: '0 0 150px'}}>
            <label htmlFor="environment" className={classes.fieldLabel}>Environment</label>
            <Dropdown
              id="environment"
              value={values.environment || 'Other'}
              onChange={(e) => handleDropdownChange('environment', e.value)}
              options={environmentOptions}
              optionLabel="label"
              optionValue="value"
              className={classes.formInput}
              disabled={isLoadingVpns || isTestingConnection}
            />
          </div>
          <div style={{flex: '0 0 150px'}}>
            <label htmlFor="region" className={classes.fieldLabel}>Region/DC</label>
            <InputText 
              id="region" 
              className={classes.formInput} 
              value={values.region || ''} 
              onChange={handleInputChange}
              placeholder="Unspecified"
              disabled={isLoadingVpns || isTestingConnection}
            />
          </div>
          <div style={{flex: '0 0 150px'}}>
            <label htmlFor="type" className={classes.fieldLabel}>Type</label>
            <Dropdown
              id="type"
              value={values.type || 'Generic'}
              onChange={(e) => handleDropdownChange('type', e.value)}
              options={typeOptions}
              optionLabel="label"
              optionValue="value"
              className={classes.formInput}
              disabled={isLoadingVpns || isTestingConnection}
            />
          </div>
        </div>
      </div>

          {/* Divider */}
          <div className={classes.sectionDivider}></div>

          {/* Step 2 Section */}
          <div>
            {/* Row 1: Messaging (SMF) Host or IP, Websocket Port, TLS */}
            <div style={{display:'flex', gap: '0.6rem', marginBottom: '1rem'}}>
              <div style={{flex: 1}}>
                <label htmlFor="messagingHost" className={classes.fieldLabel}>Messaging (SMF) Host or IP</label>
                <InputText 
                  id="messagingHost" 
                  className={classes.formInput} 
                  value={values.messagingHost || values.hostName || ''} 
                  onChange={handleMessagingHostChange}
                  disabled={isLoadingVpns || isTestingConnection}
                />
              </div>
              <div style={{flex: '0 0 120px'}}>
                <label htmlFor="clientPort" className={classes.fieldLabel}>Websocket Port</label>
                <InputText 
                  id="clientPort" 
                  className={classes.formInput} 
                  value={values.clientPort || ''} 
                  onChange={handleInputChange}
                  disabled={isLoadingVpns || isTestingConnection}
                />
              </div>
              <div style={{flex: '0 0 80px', display: 'flex', flexDirection: 'column'}}>
                <label htmlFor="useTls" className={classes.fieldLabel}>TLS</label>
                <div style={{display: 'flex', alignItems: 'center', height: '2.5rem'}}>
                  <Checkbox 
                    id="useTls" 
                    onChange={handleInputChange} 
                    checked={values.useTls !== false}
                    disabled={isLoadingVpns || isTestingConnection}
                  />
                </div>
              </div>
            </div>

            {/* Row 2: Messaging (SMF) Client Username, Password */}
            <div style={{display:'flex', gap: '0.6rem', marginBottom: '1rem'}}>
              <div style={{flex: '0 0 300px'}}>
                <label htmlFor="clientUsername" className={classes.fieldLabel}>Messaging (SMF) Client Username</label>
                <InputText 
                  id="clientUsername" 
                  className={classes.formInput} 
                  value={values.clientUsername || ''} 
                  onChange={handleInputChange}
                  disabled={isLoadingVpns || isTestingConnection}
                />
              </div>
              <div style={{flex: 1}}>
                <label htmlFor="clientPassword" className={classes.fieldLabel}>Password</label>
                <Password 
                  inputId="clientPassword" 
                  className={classes.passwordInput} 
                  feedback={false} 
                  value={values.clientPassword || ''} 
                  onChange={handleInputChange}
                  disabled={isLoadingVpns || isTestingConnection}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: VPN List (full height) */}
        <div className={classes.rightColumn}>
          <label className={classes.fieldLabel}>VPN List</label>
          {isLoadingVpns ? (
            <div style={{padding: '1rem', textAlign: 'center'}}>Loading VPNs...</div>
          ) : vpnList.length === 0 && !vpnsLoaded ? (
            <div style={{padding: '1rem', textAlign: 'center', color: 'var(--text-color-secondary)', fontSize: '0.875rem'}}>
              Click "Get VPNs" to load VPN list
            </div>
          ) : vpnList.length === 0 ? (
            <div style={{padding: '1rem', textAlign: 'center', color: 'var(--text-color-secondary)', fontSize: '0.875rem'}}>
              No VPNs found on this broker.
            </div>
          ) : (
            <div className={classes.vpnListContainerFullHeight}>
              {vpnList.map((vpnName) => {
                const isSelected = selectedVpns.includes(vpnName);
  return (
                  <div 
                    key={vpnName} 
                    className={classes.vpnListItem}
                  >
                    <Checkbox 
                      inputId={`vpn-checkbox-${vpnName}`}
                      checked={isSelected}
                      onChange={() => handleVpnToggle(vpnName)}
                      disabled={isLoadingVpns || isTestingConnection}
                    />
                    <label 
                      htmlFor={`vpn-checkbox-${vpnName}`}
                      style={{marginLeft: '0.5rem', cursor: 'pointer', flex: 1, fontSize: '0.875rem'}}
                      onClick={(e) => {
                        e.preventDefault();
                        if (!isLoadingVpns) {
                          handleVpnToggle(vpnName);
                        }
                      }}
                    >
                      {vpnName}
                    </label>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </form>
  );


  // Render edit mode form (similar layout to Add broker)
  const renderEditForm = () => {
    // Extract name from displayName (format: "name:vpn")
    const displayNameParts = values.displayName ? values.displayName.split(':') : [];
    const brokerName = displayNameParts.length > 1 ? displayNameParts[0] : (values.name || '');
    const vpnName = displayNameParts.length > 1 ? displayNameParts[1] : (values.vpn || '');
    
    return (
      <form autoComplete="off">
        <div style={{display: 'flex', flexDirection: 'column'}}>
          {/* Form Fields */}
          <div className={classes.leftColumn}>
            {/* Name field */}
            <div style={{marginBottom: '1rem'}}>
              <label htmlFor="name" className={classes.fieldLabel}>Name</label>
              <InputText 
                id="name" 
                className={classes.formInput} 
                value={brokerName} 
                onChange={(e) => {
                  const newName = e.target.value;
                  const newDisplayName = vpnName ? `${newName}:${vpnName}` : newName;
                  setValues({ ...values, name: newName, displayName: newDisplayName });
                }}
                style={{maxWidth: '300px'}}
              />
            </div>

            {/* Step 1 Section */}
            <div>
              {/* Row 1: Management (SEMP) Hostname or IP, Port, TLS */}
              <div style={{display:'flex', gap: '0.6rem', marginBottom: '1rem'}}>
                <div style={{flex: 1}}>
                  <label htmlFor="hostName" className={classes.fieldLabel}>Management (SEMP) Hostname or IP</label>
                  <InputText 
                    id="hostName" 
                    className={classes.formInput} 
                    value={values.hostName || ''} 
                    onChange={handleInputChange}
                  />
                </div>
                <div style={{flex: '0 0 120px'}}>
                  <label htmlFor="sempPort" className={classes.fieldLabel}>Port</label>
                  <InputText 
                    id="sempPort" 
                    className={classes.formInput} 
                    value={values.sempPort || ''} 
                    onChange={handleInputChange}
                  />
                </div>
                <div style={{flex: '0 0 80px', display: 'flex', flexDirection: 'column'}}>
                  <label htmlFor="sempUseTls" className={classes.fieldLabel}>TLS</label>
                  <div style={{display: 'flex', alignItems: 'center', height: '2.5rem'}}>
                    <Checkbox 
                      id="sempUseTls" 
                      onChange={handleInputChange} 
                      checked={values.sempUseTls !== false} 
                    />
                  </div>
                </div>
              </div>

              {/* Row 2: Management (SEMP) Username, Password */}
              <div style={{display:'flex', gap: '0.6rem', marginBottom: '1rem'}}>
                <div style={{flex: '0 0 300px'}}>
                  <label htmlFor="sempUsername" className={classes.fieldLabel}>Management (SEMP) Username</label>
                  <InputText 
                    id="sempUsername" 
                    className={classes.formInput} 
                    value={values.sempUsername || ''} 
                    onChange={handleInputChange}
                  />
                </div>
                <div style={{flex: 1}}>
                  <label htmlFor="sempPassword" className={classes.fieldLabel}>Password</label>
                  <Password 
                    inputId="sempPassword" 
                    className={classes.passwordInput} 
                    feedback={false} 
                    value={values.sempPassword || ''} 
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              {/* Row 3: ENV | Region | Type */}
              <div style={{display:'flex', gap: '0.6rem', marginBottom: '1rem'}}>
                <div style={{flex: '0 0 150px'}}>
                  <label htmlFor="environment" className={classes.fieldLabel}>Environment</label>
                  <Dropdown
                    id="environment"
                    value={values.environment || 'Other'}
                    onChange={(e) => handleDropdownChange('environment', e.value)}
                    options={environmentOptions}
                    optionLabel="label"
                    optionValue="value"
                    className={classes.formInput}
                  />
                </div>
                <div style={{flex: '0 0 150px'}}>
                  <label htmlFor="region" className={classes.fieldLabel}>Region/DC</label>
                  <InputText 
                    id="region" 
                    className={classes.formInput} 
                    value={values.region || ''} 
                    onChange={handleInputChange}
                    placeholder="Unspecified"
                  />
                </div>
                <div style={{flex: '0 0 150px'}}>
                  <label htmlFor="type" className={classes.fieldLabel}>Type</label>
                  <Dropdown
                    id="type"
                    value={values.type || 'Generic'}
                    onChange={(e) => handleDropdownChange('type', e.value)}
                    options={typeOptions}
                    optionLabel="label"
                    optionValue="value"
                    className={classes.formInput}
                  />
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className={classes.sectionDivider}></div>

            {/* Step 2 Section */}
            <div>
              {/* Row 1: Messaging (SMF) Host or IP, Websocket Port, TLS */}
              <div style={{display:'flex', gap: '0.6rem', marginBottom: '1rem'}}>
                <div style={{flex: 1}}>
                  <label htmlFor="messagingHost" className={classes.fieldLabel}>Messaging (SMF) Host or IP</label>
                  <InputText 
                    id="messagingHost" 
                    className={classes.formInput} 
                    value={values.messagingHost || values.hostName || ''} 
                    onChange={handleMessagingHostChange}
                  />
                </div>
                <div style={{flex: '0 0 120px'}}>
                  <label htmlFor="clientPort" className={classes.fieldLabel}>Websocket Port</label>
                  <InputText 
                    id="clientPort" 
                    className={classes.formInput} 
                    value={values.clientPort || ''} 
                    onChange={handleInputChange}
                  />
                </div>
                <div style={{flex: '0 0 80px', display: 'flex', flexDirection: 'column'}}>
                  <label htmlFor="useTls" className={classes.fieldLabel}>TLS</label>
                  <div style={{display: 'flex', alignItems: 'center', height: '2.5rem'}}>
                    <Checkbox 
                      id="useTls" 
                      onChange={handleInputChange} 
                      checked={values.useTls !== false}
                    />
                  </div>
                </div>
              </div>

              {/* Row 2: Messaging (SMF) Client Username, Password */}
              <div style={{display:'flex', gap: '0.6rem', marginBottom: '1rem'}}>
                <div style={{flex: '0 0 300px'}}>
                  <label htmlFor="clientUsername" className={classes.fieldLabel}>Messaging (SMF) Client Username</label>
                  <InputText 
                    id="clientUsername" 
                    className={classes.formInput} 
                    value={values.clientUsername || ''} 
                    onChange={handleInputChange}
                  />
                </div>
                <div style={{flex: 1}}>
                  <label htmlFor="clientPassword" className={classes.fieldLabel}>Password</label>
                  <Password 
                    inputId="clientPassword" 
                    className={classes.passwordInput} 
                    feedback={false} 
                    value={values.clientPassword || ''} 
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              {/* VPN field */}
              <div style={{marginBottom: '1rem'}}>
                <label htmlFor="vpn" className={classes.fieldLabel}>VPN</label>
                <InputText 
                  id="vpn" 
                  className={classes.formInput} 
                  value={vpnName} 
                  onChange={(e) => {
                    const newVpn = e.target.value;
                    const newDisplayName = brokerName ? `${brokerName}:${newVpn}` : newVpn;
                    setValues({ ...values, vpn: newVpn, displayName: newDisplayName });
                  }}
                  style={{maxWidth: '300px'}}
                />
              </div>
            </div>
          </div>
        </div>
      </form>
    );
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && visible) {
        handleHide();
      }
    };

    if (visible) {
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [visible, handleHide]);

  return (
    <Dialog 
      className={classes.formDialog}
      header={Header}
      footer={Footer}
      maskStyle={{ position: 'absolute', borderRadius: 6 }}
      visible={visible}
      onHide={handleHide}
    >
      <Toast ref={toast} />
      {isEditMode ? renderEditForm() : renderNewBrokerForm()}
    </Dialog>
  );
}

BrokerConfigDialog.propTypes = {
  config: PropTypes.object,
  brokerEditor: PropTypes.object.isRequired,
  onHide: PropTypes.func.isRequired
};