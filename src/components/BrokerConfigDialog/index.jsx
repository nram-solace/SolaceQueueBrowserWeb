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
      // Edit mode: use existing single-dialog approach
    setValues({
      id: 0,
      displayName: '',
      hostName: '',
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
        type: 'Generic',
        label: '',
      ...(config || {})
    });
      setCurrentStep(1);
    } else {
      // New broker: initialize single page form
      setValues({
        id: 0,
        name: '',
        hostName: '',
        messagingHost: '',
        sempPort: '',
        sempUseTls: true,
        sempUsername: '',
        sempPassword: '',
        environment: 'Other',
        type: 'Generic',
        clientPort: '',
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
      toast.current?.show({
        severity: 'error',
        summary: 'Validation Error',
        detail: 'Please fill in Management (SEMP) hostname, port, username and password to fetch VPNs.',
        life: 3000
      });
      return;
    }

    // Validate port is numeric
    if (isNaN(parseInt(values.sempPort))) {
      toast.current?.show({
        severity: 'error',
        summary: 'Validation Error',
        detail: 'SEMP Port must be a number.',
        life: 3000
      });
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
        toast.current?.show({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to fetch VPNs from broker.',
          life: 3000
        });
        setVpnList([]);
      }
    } catch (err) {
      console.error('Error fetching VPNs:', err);
      toast.current?.show({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to fetch VPNs from broker.',
        life: 3000
      });
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
      console.error('WebSocket connection error:', err);
      
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
        const errMsg = err.message || err.toString();
        if (errMsg.includes('invalid URL')) {
          errorMessage = 'Invalid broker URL.';
        } else if (errMsg.includes('Connection error') || errMsg.includes('NetworkError')) {
          errorMessage = 'Unable to connect to broker. Please check the hostname, port, and network connectivity.';
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
      toast.current?.show({
        severity: 'error',
        summary: 'Validation Error',
        detail: 'Please fill in Messaging (SMF) Host or IP.',
        life: 3000
      });
      return;
    }

    if (!values.clientPort || !values.clientUsername || !values.clientPassword) {
      toast.current?.show({
        severity: 'error',
        summary: 'Validation Error',
        detail: 'Please fill in Websocket Port, Client Username and Password.',
        life: 3000
      });
      return;
    }

    // Validate port is numeric
    if (isNaN(parseInt(values.clientPort))) {
      toast.current?.show({
        severity: 'error',
        summary: 'Validation Error',
        detail: 'Websocket Port must be a number.',
        life: 3000
      });
      return;
    }

    // Validate at least one VPN selected
    if (!selectedVpns || selectedVpns.length === 0) {
      toast.current?.show({
        severity: 'error',
        summary: 'Validation Error',
        detail: 'Please select at least one VPN to test.',
        life: 3000
      });
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
        
        toast.current?.show({
          severity: 'error',
          summary: `${protocol} Connection Test Results`,
          detail: detailMessage,
          life: 10000
        });
      } else {
        // All connections succeeded
        toast.current?.show({
          severity: 'success',
          summary: `${protocol} Connection Test Passed`,
          detail: `All ${selectedVpns.length} VPN connection${selectedVpns.length === 1 ? '' : 's'} tested successfully:\n${selectedVpns.join(', ')}`,
          life: 5000
        });
      }
    } catch (err) {
      console.error('Error during connection test:', err);
      toast.current?.show({
        severity: 'error',
        summary: 'Connection Test Error',
        detail: 'An unexpected error occurred during connection testing. Please try again.',
        life: 5000
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  // Save broker entries for selected VPNs (without testing)
  const handleSave = () => {
    // Validate Step 1 required fields
    if (!values.name || !values.hostName || !values.sempPort || !values.sempUsername || !values.sempPassword) {
      toast.current?.show({
        severity: 'error',
        summary: 'Validation Error',
        detail: 'Please fill in all required Step 1 fields.',
        life: 3000
      });
      return;
    }

    // Validate Step 2 required fields
    if (!values.clientPort || !values.clientUsername || !values.clientPassword) {
      toast.current?.show({
        severity: 'error',
        summary: 'Validation Error',
        detail: 'Please fill in all required Step 2 fields.',
        life: 3000
      });
      return;
    }

    // Validate ports are numeric
    if (isNaN(parseInt(values.sempPort))) {
      toast.current?.show({
        severity: 'error',
        summary: 'Validation Error',
        detail: 'SEMP Port must be a number.',
        life: 3000
      });
      return;
    }

    if (isNaN(parseInt(values.clientPort))) {
      toast.current?.show({
        severity: 'error',
        summary: 'Validation Error',
        detail: 'Websocket Port must be a number.',
        life: 3000
      });
      return;
    }

    // Validate at least one VPN selected
    if (!selectedVpns || selectedVpns.length === 0) {
      toast.current?.show({
        severity: 'error',
        summary: 'Validation Error',
        detail: 'Please select at least one VPN.',
        life: 3000
      });
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
        type: values.type
      };
      brokerEditor.save(brokerConfig);
    });

    // Show success message
    toast.current?.show({
      severity: 'success',
      summary: 'Success',
      detail: `Created ${selectedVpns.length} broker entr${selectedVpns.length === 1 ? 'y' : 'ies'}.`,
      life: 3000
    });

    // Close dialog
    onHide?.();
  };

  const handleSaveEdit = () => {
    brokerEditor.save(values);
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
    toast.current.show(message);
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

        {/* Row 3: ENV | Type */}
        <div style={{display:'flex', gap: '0.6rem', marginBottom: '1rem'}}>
          <div style={{flex: '0 0 150px'}}>
            <label htmlFor="environment" className={classes.fieldLabel}>ENV</label>
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


  // Render edit mode form (existing behavior)
  const renderEditForm = () => (
      <form autoComplete="off">
        <FloatLabel className={classes.formField}>
          <InputText id="displayName" className={classes.formInput} value={values.displayName} onChange={handleInputChange} />
          <label htmlFor="displayName">Display Name</label>
        </FloatLabel>
        <FloatLabel className={classes.formField}>
            <InputText id="hostName" className={classes.formInput} value={values.hostName} onChange={handleInputChange} />
            <label htmlFor="hostName">Hostname</label>
        </FloatLabel>
        <div className={classes.formField} style={{display:'flex', gap: '0.6rem'}}>
          <FloatLabel style={{flex: 1}}>
              <InputText id="clientPort" className={classes.formInput} value={values.clientPort} onChange={handleInputChange} />
              <label htmlFor="clientPort">WS Port</label>
          </FloatLabel>
          <FloatLabel style={{flex: 1}}>
              <InputText id="sempPort" className={classes.formInput} value={values.sempPort} onChange={handleInputChange} />
              <label htmlFor="sempPort">SEMP Port</label>
          </FloatLabel>
          <div style={{flex: 1}}>
            <Checkbox id="useTls" onChange={handleInputChange} checked={values.useTls} style={{height:'100%', paddingTop:'0.5rem'}}/>
            <label htmlFor="useTls" className={classes.checkboxLabel}>Use TLS</label>
          </div>
        </div>
        <FloatLabel className={classes.formField}>
            <InputText id="vpn" className={classes.formInput} value={values.vpn} onChange={handleInputChange} />
            <label htmlFor="vpn">VPN</label>
        </FloatLabel>
        <FloatLabel className={classes.formField}>
            <InputText id="clientUsername" className={classes.formInput} value={values.clientUsername} onChange={handleInputChange} />
            <label htmlFor="clientUsername">Client Username</label>
        </FloatLabel>
        <FloatLabel className={classes.formField}>
            <Password inputId="clientPassword" className={classes.passwordInput} feedback={false} value={values.clientPassword} onChange={handleInputChange} />
            <label htmlFor="clientPassword">Client Password</label>
        </FloatLabel>
        <FloatLabel className={classes.formField}>
            <InputText id="sempUsername" className={classes.formInput} value={values.sempUsername} onChange={handleInputChange} />
            <label htmlFor="sempUsername">SEMP Username</label>
        </FloatLabel>
        <FloatLabel className={classes.formField}>
            <Password inputId="sempPassword" className={classes.passwordInput} feedback={false} value={values.sempPassword} onChange={handleInputChange} />
            <label htmlFor="sempPassword">SEMP Password</label>
        </FloatLabel> 
      </form>
  );

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