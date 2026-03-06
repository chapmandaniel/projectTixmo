import React, { useState, useEffect } from 'react';
import { Search, Plus, RefreshCw, Smartphone, History, Trash2, Power, PowerOff } from 'lucide-react';
import api from '../lib/api';
import RegisterScannerModal from './RegisterScannerModal';

const ScannersView = ({ isDark, user }) => {
    const [activeTab, setActiveTab] = useState('scanners'); // 'scanners' | 'logs'
    const [scanners, setScanners] = useState([]);
    const [logs, setLogs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    useEffect(() => {
        if (activeTab === 'scanners') {
            fetchScanners();
        } else {
            fetchLogs();
        }
    }, [activeTab, page]);

    const fetchScanners = async () => {
        try {
            setIsLoading(true);
            const params = { page, limit: 10 };
            // If user has organizationId, we could pass it, but admin might see all?
            // Usually API filters by user's permission scope automatically.
            const response = await api.get('/scanners', { params });
            if (response.data.success) {
                setScanners(response.data.data); // Assuming array or {scanners: [], pagination: {}}
                // Adjust if response structure is nested
                if (response.data.pagination) {
                    setTotalPages(response.data.pagination.pages);
                } else if (response.data.data.pagination) {
                    setScanners(response.data.data.scanners || response.data.data); // heuristic
                    setTotalPages(response.data.data.pagination.pages);
                }
            }
        } catch (error) {
            console.error('Failed to fetch scanners:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchLogs = async () => {
        try {
            setIsLoading(true);
            const params = { page, limit: 20 };
            const response = await api.get('/scanners/logs', { params });
            if (response.data.success) {
                setLogs(response.data.data); // structure might vary
                if (response.data.pagination) setTotalPages(response.data.pagination.pages);
                else if (response.data.data.scanLogs) {
                    setLogs(response.data.data.scanLogs);
                    setTotalPages(response.data.data.pagination.pages);
                }
            }
        } catch (error) {
            console.error('Failed to fetch logs:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRevoke = async (id) => {
        if (!window.confirm('Are you sure you want to revoke this scanner? It will no longer be able to scan tickets.')) return;
        try {
            await api.delete(`/scanners/${id}`);
            fetchScanners();
        } catch (error) {
            alert('Failed to revoke scanner');
        }
    };

    return (
        <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
            {isRegisterModalOpen && (
                <RegisterScannerModal
                    onClose={() => setIsRegisterModalOpen(false)}
                    onSuccess={fetchScanners}
                    isDark={isDark}
                />
            )}

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className={`text-3xl font-light tracking-tight ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>Scanner Management</h2>
                    <p className={`mt-1 text-lg font-light ${isDark ? 'text-[#a1a5b7]' : 'text-gray-500'}`}>
                        Manage scanning devices and view entry logs.
                    </p>
                </div>
                <button
                    onClick={() => setIsRegisterModalOpen(true)}
                    className="flex items-center justify-center space-x-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-orange-400 hover:from-pink-600 hover:to-orange-500 shadow-md shadow-pink-500/20 text-white rounded-md transition-colors font-light tracking-wide text-sm"
                >
                    <Plus size={18} />
                    <span>Register New Scanner</span>
                </button>
            </div>

            {/* Tabs */}
            <div className={`border-b border-[#2b2b40] ${isDark ? 'border-[#2b2b40]' : 'border-gray-200'}`}>
                <div className="flex space-x-8">
                    <button
                        onClick={() => { setActiveTab('scanners'); setPage(1); }}
                        className={`pb-4 text-sm font-light tracking-wide transition-colors relative ${activeTab === 'scanners'
                            ? (isDark ? 'text-white' : 'text-pink-600')
                            : (isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700')
                            }`}
                    >
                        <div className="flex items-center space-x-2">
                            <Smartphone size={18} />
                            <span>Active Scanners</span>
                        </div>
                        {activeTab === 'scanners' && (
                            <div className={`absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-pink-500 to-orange-400 ${isDark ? '' : ''}`} />
                        )}
                    </button>
                    <button
                        onClick={() => { setActiveTab('logs'); setPage(1); }}
                        className={`pb-4 text-sm font-light tracking-wide transition-colors relative ${activeTab === 'logs'
                            ? (isDark ? 'text-white' : 'text-pink-600')
                            : (isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700')
                            }`}
                    >
                        <div className="flex items-center space-x-2">
                            <History size={18} />
                            <span>Scan Logs</span>
                        </div>
                        {activeTab === 'logs' && (
                            <div className={`absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-pink-500 to-orange-400 ${isDark ? '' : ''}`} />
                        )}
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className={`overflow-hidden rounded-md border ${isDark ? 'border-[#2b2b40] bg-[#1e1e2d]' : 'border-gray-200 bg-white'}`}>
                {isLoading ? (
                    <div className="p-20 text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto"></div>
                        <p className={`mt-4 text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Loading...</p>
                    </div>
                ) : (
                    <>
                        {activeTab === 'scanners' ? (
                            // SCANNERS LIST
                            scanners.length === 0 ? (
                                <div className="p-20 text-center">
                                    <Smartphone className={`mx-auto mb-4 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} size={48} />
                                    <p className={`text-lg font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>No scanners registered</p>
                                    <p className={`text-sm ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>Register a device to start scanning tickets.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className={`text-xs uppercase tracking-wider border-b ${isDark ? 'bg-[#2b2b40] text-[#a1a5b7] border-[#3a3a5a]' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                                            <tr>
                                                <th className="p-4 font-light tracking-wide">Name</th>
                                                <th className="p-4 font-light tracking-wide">Device ID</th>
                                                <th className="p-4 font-light tracking-wide">Status</th>
                                                <th className="p-4 font-light tracking-wide">Last Active</th>
                                                <th className="p-4 font-light tracking-wide text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className={`text-sm divide-y font-light tracking-wide ${isDark ? 'divide-[#2b2b40] text-gray-300' : 'divide-gray-100 text-gray-600'}`}>
                                            {scanners.map((scanner) => (
                                                <tr key={scanner.id} className={`group transition-colors ${isDark ? 'hover:bg-[#232336]' : 'hover:bg-gray-50'}`}>
                                                    <td className="p-4">{scanner.name}</td>
                                                    <td className="p-4 font-mono text-xs opacity-70">{scanner.deviceId || 'N/A'}</td>
                                                    <td className="p-4">
                                                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${scanner.status === 'ACTIVE'
                                                            ? (isDark ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-green-50 text-green-700 border-green-100')
                                                            : (isDark ? 'bg-red-900/20 text-red-400 border-red-900/30' : 'bg-red-50 text-red-600 border-red-100')
                                                            }`}>
                                                            {scanner.status}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-xs">
                                                        {scanner.lastActiveAt ? new Date(scanner.lastActiveAt).toLocaleString() : 'Never'}
                                                    </td>
                                                    <td className="p-4 text-right">
                                                        <button
                                                            onClick={() => handleRevoke(scanner.id)}
                                                            className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-red-900/20 text-red-400' : 'hover:bg-red-50 text-red-600'}`}
                                                            title="Revoke Access"
                                                        >
                                                            <PowerOff size={16} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )
                        ) : (
                            // LOGS LIST
                            logs.length === 0 ? (
                                <div className="p-20 text-center">
                                    <History className={`mx-auto mb-4 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} size={48} />
                                    <p className={`text-lg font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>No scan logs found</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className={`text-xs uppercase tracking-wider border-b ${isDark ? 'bg-[#2b2b40] text-[#a1a5b7] border-[#3a3a5a]' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                                            <tr>
                                                <th className="p-4 font-light tracking-wide">Time</th>
                                                <th className="p-4 font-light tracking-wide">Type</th>
                                                <th className="p-4 font-light tracking-wide">Scanner</th>
                                                <th className="p-4 font-light tracking-wide">Ticket</th>
                                                <th className="p-4 font-light tracking-wide">Result</th>
                                            </tr>
                                        </thead>
                                        <tbody className={`text-sm divide-y font-light tracking-wide ${isDark ? 'divide-[#2b2b40] text-gray-300' : 'divide-gray-100 text-gray-600'}`}>
                                            {Array.isArray(logs) && logs.map((log) => (
                                                <tr key={log.id} className={`group transition-colors ${isDark ? 'hover:bg-[#232336]' : 'hover:bg-gray-50'}`}>
                                                    <td className="p-4 whitespace-nowrap">
                                                        {new Date(log.scannedAt).toLocaleString()}
                                                    </td>
                                                    <td className="p-4">
                                                        <span className={`font-medium ${log.scanType === 'ENTRY' ? 'text-blue-500' : 'text-orange-500'
                                                            }`}>
                                                            {log.scanType}
                                                        </span>
                                                    </td>
                                                    <td className="p-4">{log.scanner?.name || 'Unknown'}</td>
                                                    <td className="p-4 font-mono text-xs max-w-[100px] truncate" title={log.ticketId}>
                                                        {log.ticketId}
                                                    </td>
                                                    <td className="p-4">
                                                        <span className={`px-2 py-1 rounded text-xs font-medium ${log.success
                                                            ? (isDark ? 'bg-green-500/10 text-green-400' : 'bg-green-50 text-green-700')
                                                            : (isDark ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-600')
                                                            }`}>
                                                            {log.success ? 'SUCCESS' : 'DENIED'}
                                                        </span>
                                                        {!log.success && log.metadata?.reason && (
                                                            <span className="ml-2 text-xs opacity-60">({log.metadata.reason})</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default ScannersView;
