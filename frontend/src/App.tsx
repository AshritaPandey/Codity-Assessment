import { useState, useEffect } from 'react';
import { LayoutDashboard, List, Activity, Settings, RefreshCw, PlayCircle, LogOut, Moon, Sun, AlertTriangle, Clock } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
const SOCKET_URL = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : 'http://localhost:4000';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [currentUserEmail, setCurrentUserEmail] = useState(localStorage.getItem('email') || 'admin@jobscheduler.com');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');

  const [activeTab, setActiveTab] = useState('dashboard');
  const [theme, setTheme] = useState('dark');
  const [stats, setStats] = useState({ totalJobs: 0, runningJobs: 0, failedJobs: 0, dlqJobs: 0, queuedJobs: 0, successRate: '0.0%' });
  const [jobs, setJobs] = useState<any[]>([]);
  const [queues, setQueues] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [dlqJobsList, setDlqJobsList] = useState<any[]>([]);

  useEffect(() => {
    if (!token) return;

    const socket = io(SOCKET_URL);

    // Socket.io disabled for multi-tenant isolation, using polling instead.
    
    return () => { socket.close(); };
  }, [token]);

  useEffect(() => {
    if (!token) return;
    
    // Initial fetch
    if (activeTab === 'dashboard') {
      fetchRecentJobs();
      fetchStats();
    }
    if (activeTab === 'queues') fetchQueues();
    if (activeTab === 'workers') fetchWorkers();
    if (activeTab === 'dlq') fetchDlqJobs();

    // Polling for dashboard stats to replace the global socket emit
    let interval: NodeJS.Timeout;
    if (activeTab === 'dashboard') {
      interval = setInterval(() => {
        fetchStats();
        fetchRecentJobs();
      }, 2000);
    }
    return () => { if (interval) clearInterval(interval); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, token]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/register';
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) {
        let msg = data.error || 'Authentication failed';
        if (data.details && data.details.length > 0) {
          msg += `: ${data.details[0].message}`;
        }
        throw new Error(msg);
      }
      
      if (isLogin) {
        localStorage.setItem('token', data.token);
        if (data.user && data.user.email) {
          localStorage.setItem('email', data.user.email);
          setCurrentUserEmail(data.user.email);
        }
        setToken(data.token);
      } else {
        setIsLogin(true);
        setError('Registration successful! Please log in.');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('email');
    setToken('');
  };

  const fetchQueues = async () => {
    try {
      const res = await fetch(`${API_URL}/queues`, { headers: { Authorization: `Bearer ${token}` } });
      setQueues(await res.json());
    } catch (err) { console.error(err); }
  };

  const fetchRecentJobs = async () => {
    try {
      const res = await fetch(`${API_URL}/jobs?limit=15`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setJobs(data.data.map((j: any) => ({
        id: j.id,
        type: j.type,
        status: j.status,
        priority: j.priority,
        createdAt: new Date(j.createdAt).toLocaleTimeString()
      })));
    } catch (err) { console.error(err); }
  };

  const fetchWorkers = async () => {
    try {
      const res = await fetch(`${API_URL}/workers`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setWorkers(Array.isArray(data) ? data : []);
    } catch (err) { 
      console.error(err);
      setWorkers([]);
    }
  };

  const fetchDlqJobs = async () => {
    try {
      const res = await fetch(`${API_URL}/jobs?status=DLQ`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setDlqJobsList(data.data || []);
    } catch (err) { console.error(err); }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_URL}/jobs/stats`, { headers: { Authorization: `Bearer ${token}` } });
      const newStats = await res.json();
      const completed = newStats.COMPLETED || 0;
      const failed = newStats.FAILED || 0;
      const dlq = newStats.DLQ || 0;
      const queued = newStats.QUEUED || 0;
      const totalProcessed = completed + failed + dlq;
      const rate = totalProcessed > 0 ? ((completed / totalProcessed) * 100).toFixed(1) + '%' : '0.0%';
      setStats({
        totalJobs: totalProcessed,
        runningJobs: newStats.RUNNING || 0,
        failedJobs: failed,
        dlqJobs: dlq,
        queuedJobs: queued,
        successRate: rate,
      });
    } catch (err) { console.error(err); }
  };

  const runTestJob = async () => {
    try {
      let qId = queues.length > 0 ? queues[0].id : null;
      if (!qId) {
        const res = await fetch(`${API_URL}/queues`, { headers: { Authorization: `Bearer ${token}` } });
        const qs = await res.json();
        qId = qs[0]?.id;
      }
      
      if (!qId) {
        alert("No queue available to run jobs!");
        return;
      }

      await fetch(`${API_URL}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          queueId: qId,
          type: 'IMMEDIATE',
          shardKey: Math.floor(Math.random() * 4) + 1,
          payload: { mockDuration: Math.floor(Math.random() * 3000) + 1000 },
        })
      });
      fetchStats();
    } catch (err) { console.error(err); }
  };

  const retryJob = async (jobId: string) => {
    try {
      await fetch(`${API_URL}/jobs/${jobId}/retry`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (err) { console.error(err); }
  };

  if (!token) {
    return (
      <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="card" style={{ width: '400px', padding: '3rem 2rem' }}>
          <div className="logo" style={{ justifyContent: 'center', marginBottom: '2rem' }}>
            <Activity size={32} /> JobScheduler
          </div>
          <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {error && <div style={{ color: 'var(--danger-color)', fontSize: '0.875rem', textAlign: 'center' }}>{error}</div>}
            <input 
              type="email" 
              placeholder="Email address" 
              value={email} 
              onChange={e => setEmail(e.target.value)}
              style={{ padding: '0.75rem', borderRadius: '0.5rem', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}
              required 
            />
            <input 
              type="password" 
              placeholder="Password" 
              value={password} 
              onChange={e => setPassword(e.target.value)}
              style={{ padding: '0.75rem', borderRadius: '0.5rem', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}
              required 
            />
            <button type="submit" className="btn btn-primary" style={{ justifyContent: 'center', marginTop: '1rem' }}>
              {isLogin ? 'Sign In' : 'Create Account'}
            </button>
            <div style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '1rem', cursor: 'pointer' }} onClick={() => setIsLogin(!isLogin)}>
              {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="logo">
          <Activity size={28} />
          JobScheduler
        </div>
        
        <nav className="nav-links">
          <a className={`nav-link ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
            <LayoutDashboard size={20} /> Dashboard
          </a>
          <a className={`nav-link ${activeTab === 'queues' ? 'active' : ''}`} onClick={() => setActiveTab('queues')}>
            <List size={20} /> Queues
          </a>
          <a className={`nav-link ${activeTab === 'workers' ? 'active' : ''}`} onClick={() => setActiveTab('workers')}>
            <RefreshCw size={20} /> Workers
          </a>
          <a className={`nav-link ${activeTab === 'dlq' ? 'active' : ''}`} onClick={() => setActiveTab('dlq')}>
            <AlertTriangle size={20} /> Dead Letter Queue
          </a>
          <a className={`nav-link ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
            <Settings size={20} /> Settings
          </a>
        </nav>

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '1rem', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary-color), var(--primary-hover))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'white', textTransform: 'uppercase' }}>
                {currentUserEmail.charAt(0)}
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>
                  {currentUserEmail.split('@')[0].charAt(0).toUpperCase() + currentUserEmail.split('@')[0].slice(1)}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textOverflow: 'ellipsis', overflow: 'hidden' }}>{currentUserEmail}</div>
              </div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {theme === 'dark' ? <Moon size={14} /> : <Sun size={14} />} Theme
              </span>
              <button 
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                style={{
                  width: '40px', height: '22px', borderRadius: '20px', background: theme === 'dark' ? 'var(--primary-color)' : '#cbd5e1', border: 'none', position: 'relative', cursor: 'pointer', transition: 'background 0.3s'
                }}
              >
                <div style={{
                  position: 'absolute', top: '2px', left: theme === 'dark' ? '20px' : '2px', width: '18px', height: '18px', borderRadius: '50%', background: 'white', transition: 'left 0.3s'
                }}></div>
              </button>
            </div>
          </div>

          <a className="nav-link" onClick={logout} style={{ color: 'var(--danger-color)' }}>
            <LogOut size={20} /> Sign Out
          </a>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content animate-fade-in">
        <div className="header">
          <h1 className="title">
            {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
          </h1>
          {activeTab === 'dashboard' && (
            <button className="btn btn-primary" onClick={runTestJob}>
              <PlayCircle size={18} /> Run Test Job
            </button>
          )}
        </div>

        {activeTab === 'dashboard' && (
          <>
            <div className="dashboard-grid">
              <div className="card">
                <div className="stat-title">Total Jobs Processed</div>
                <div className="stat-value">{stats.totalJobs.toLocaleString()}</div>
              </div>
              <div className="card">
                <div className="stat-title">Running Jobs</div>
                <div className="stat-value" style={{ color: 'var(--info-color)' }}>{stats.runningJobs}</div>
              </div>
              <div className="card">
                <div className="stat-title">Failed Jobs</div>
                <div className="stat-value danger">{stats.failedJobs}</div>
              </div>
              <div className="card">
                <div className="stat-title">Success Rate</div>
                <div className="stat-value success">{stats.successRate}</div>
              </div>
            </div>

            {/* Recharts Visual Graph */}
            <div className="card" style={{ marginBottom: '3rem', padding: '1.5rem 2rem', height: '350px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Job Status Distribution</h3>
              </div>
              <div style={{ flex: 1, width: '100%', minHeight: 0 }}>
                {stats.totalJobs === 0 ? (
                  <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                    No job data available to display graph. Run a test job!
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Completed', value: stats.totalJobs - stats.failedJobs - stats.dlqJobs, color: '#10b981' },
                          { name: 'Running', value: stats.runningJobs, color: '#3b82f6' },
                          { name: 'Queued', value: stats.queuedJobs, color: '#eab308' },
                          { name: 'Failed', value: stats.failedJobs, color: '#f97316' },
                          { name: 'DLQ', value: stats.dlqJobs, color: '#ef4444' }
                        ].filter(d => d.value > 0)}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {
                          [
                            { name: 'Completed', value: stats.totalJobs - stats.failedJobs - stats.dlqJobs, color: '#10b981' },
                            { name: 'Running', value: stats.runningJobs, color: '#3b82f6' },
                            { name: 'Queued', value: stats.queuedJobs, color: '#eab308' },
                            { name: 'Failed', value: stats.failedJobs, color: '#f97316' },
                            { name: 'DLQ', value: stats.dlqJobs, color: '#ef4444' }
                          ].filter(d => d.value > 0).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))
                        }
                      </Pie>
                      <RechartsTooltip contentStyle={{ background: 'var(--bg-main)', border: 'none', borderRadius: '8px', color: 'var(--text-main)' }} />
                      <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <h2><Activity size={24} color="var(--info-color)" /> Recent Executions (Live)</h2>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Job ID</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Time</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.length === 0 ? (
                    <tr><td colSpan={5} style={{textAlign: 'center', color: 'var(--text-muted)'}}>Waiting for live jobs...</td></tr>
                  ) : jobs.map((job) => (
                    <tr key={job.id}>
                      <td style={{ fontFamily: 'monospace', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{job.id.split('-')[0]}...</td>
                      <td>{job.type}</td>
                      <td>
                        <span className={`badge badge-${
                          job.status === 'COMPLETED' ? 'success' : 
                          (job.status === 'FAILED' || job.status === 'DLQ') ? 'danger' : 
                          job.status === 'RUNNING' ? 'info' : 'warning'
                        }`}>
                          {job.status}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{job.createdAt}</td>
                      <td>
                        {(job.status === 'FAILED' || job.status === 'DLQ') && (
                          <button 
                            onClick={() => retryJob(job.id)}
                            style={{ 
                              background: 'transparent', 
                              border: '1px solid var(--warning-color)', 
                              color: 'var(--warning-color)', 
                              padding: '0.25rem 0.75rem', 
                              borderRadius: '0.5rem', 
                              cursor: 'pointer',
                              fontSize: '0.75rem',
                              fontWeight: 'bold'
                            }}
                          >
                            <RefreshCw size={12} style={{ marginRight: '4px', display: 'inline-block', verticalAlign: 'middle' }} /> 
                            Retry
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {activeTab === 'queues' && (
          <div className="table-container animate-fade-in">
            <table>
              <thead>
                <tr>
                  <th>Queue Name</th>
                  <th>Priority</th>
                  <th>Concurrency</th>
                  <th>Retries</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {queues.length === 0 ? (
                  <tr><td colSpan={5} style={{textAlign: 'center', color: 'var(--text-muted)'}}>No queues found.</td></tr>
                ) : queues.map((q) => (
                  <tr key={q.id}>
                    <td style={{ fontWeight: 600 }}>{q.name}</td>
                    <td>{q.priority}</td>
                    <td>{q.concurrencyLimit}</td>
                    <td>{q.maxRetries}</td>
                    <td>
                      <span className={`badge badge-${q.isPaused ? 'warning' : 'success'}`}>
                        {q.isPaused ? 'PAUSED' : 'ACTIVE'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'workers' && (
          <div className="dashboard-grid animate-fade-in">
            {(!workers || workers.length === 0) ? (
              <div style={{ color: 'var(--text-muted)', gridColumn: '1 / -1', textAlign: 'center', padding: '2rem' }}>No active workers found.</div>
            ) : (workers || []).map(w => (
              <div className="card" key={w.id}>
                <div className="stat-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  Worker Node
                  <span className={`badge badge-${w.status === 'ACTIVE' ? 'success' : 'danger'}`}>{w.status}</span>
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  {w.id}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                  <Clock size={16} /> 
                  Last Heartbeat: {w.lastHeartbeat ? new Date(w.lastHeartbeat).toLocaleTimeString() : 'N/A'}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'dlq' && (
          <div className="table-container animate-fade-in">
            <table>
              <thead>
                <tr>
                  <th>Job ID</th>
                  <th>Payload</th>
                  <th>Failed Reason</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {dlqJobsList.length === 0 ? (
                  <tr><td colSpan={4} style={{textAlign: 'center', color: 'var(--text-muted)'}}>No jobs in the Dead Letter Queue.</td></tr>
                ) : dlqJobsList.map((job) => (
                  <tr key={job.id}>
                    <td style={{ fontFamily: 'monospace', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{job.id}</td>
                    <td style={{ fontSize: '0.85rem' }}>{JSON.stringify(job.payload || {})}</td>
                    <td style={{ color: 'var(--danger-color)', fontSize: '0.85rem', maxWidth: '300px', whiteSpace: 'pre-wrap', overflow: 'hidden' }}>
                      {job.executions && job.executions.length > 0 && job.executions[0].errorMessage 
                        ? job.executions[0].errorMessage 
                        : 'Max retries exceeded'}
                    </td>
                    <td>
                      <button onClick={async () => {
                        await retryJob(job.id);
                        fetchDlqJobs(); // refresh the list
                      }} className="btn btn-primary" style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem' }}>
                        Retry Job
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="dashboard-grid animate-fade-in">
            <div className="card" style={{ gridColumn: '1 / -1' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                <Settings size={32} color="var(--primary-color)" />
                <h2 style={{ margin: 0 }}>System Configuration</h2>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                <div>
                  <h3 style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.9rem', textTransform: 'uppercase' }}>General</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'var(--border-color)', borderRadius: '0.5rem' }}>
                      <span>Enable Notifications</span>
                      <input type="checkbox" defaultChecked style={{ cursor: 'pointer' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'var(--border-color)', borderRadius: '0.5rem' }}>
                      <span>Auto-retry System</span>
                      <input type="checkbox" defaultChecked style={{ cursor: 'pointer' }} />
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.9rem', textTransform: 'uppercase' }}>Database & Workers</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'var(--border-color)', borderRadius: '0.5rem' }}>
                      <span>Worker Concurrency Limit</span>
                      <select style={{ background: 'transparent', border: '1px solid var(--text-muted)', color: 'var(--text-main)', padding: '0.2rem 0.5rem', borderRadius: '0.25rem' }}>
                        <option>10</option>
                        <option>50</option>
                        <option>100</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
