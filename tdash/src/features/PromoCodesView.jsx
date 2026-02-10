import React, { useState, useEffect } from 'react';
import { Search, Plus, Filter, RefreshCw, Tag, MoreHorizontal, Trash2, Edit } from 'lucide-react';
import api from '../lib/api';
import PromoCodeModal from './PromoCodeModal';

const PromoCodesView = ({ isDark }) => {
    const [codes, setCodes] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedCode, setSelectedCode] = useState(null); // For editing
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    useEffect(() => {
        fetchCodes();
    }, [page, statusFilter]);

    const fetchCodes = async () => {
        try {
            setIsLoading(true);
            const params = { page, limit: 10 };
            if (statusFilter) params.status = statusFilter;

            const response = await api.get('/promo-codes', { params });
            if (response.data.success) {
                const data = response.data.data;
                const codesList = Array.isArray(data) ? data : (data.results || []);
                setCodes(Array.isArray(codesList) ? codesList : []);
                setTotalPages(data.pagination?.pages || (data.results ? 1 : 1));
            }
        } catch (error) {
            console.error('Failed to fetch promo codes:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this promo code? This action cannot be undone.')) return;
        try {
            await api.delete(`/promo-codes/${id}`);
            fetchCodes();
        } catch (error) {
            alert('Failed to delete promo code: ' + (error.response?.data?.message || error.message));
        }
    };

    const filteredCodes = Array.isArray(codes) ? codes.filter(code => {
        if (!searchTerm) return true;
        return code.code.toLowerCase().includes(searchTerm.toLowerCase());
    }) : [];

    return (
        <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
            {(isCreateModalOpen || selectedCode) && (
                <PromoCodeModal
                    promoCode={selectedCode}
                    onClose={() => { setIsCreateModalOpen(false); setSelectedCode(null); }}
                    onSuccess={fetchCodes}
                    isDark={isDark}
                />
            )}

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className={`text-2xl font-medium ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>Promo Codes</h2>
                    <p className={`mt-1 text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                        Manage discounts and promotional campaigns.
                    </p>
                </div>
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="flex items-center justify-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium text-sm"
                >
                    <Plus size={18} />
                    <span>Create Promo Code</span>
                </button>
            </div>

            {/* Controls */}
            <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#1e1e1e] border-[#2a2a2a]' : 'bg-white border-gray-200'}`}>
                <div className="flex flex-col md:flex-row gap-4 justify-between">
                    <div className="flex-1 relative">
                        <Search className={`absolute left-3 top-2.5 h-5 w-5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                        <input
                            type="text"
                            placeholder="Search by Code..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className={`w-full pl-10 pr-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-indigo-500 ${isDark
                                ? 'bg-[#252525] border-[#333] text-white placeholder-gray-500'
                                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                                }`}
                        />
                    </div>
                    <div className="flex gap-3">
                        <div className="relative">
                            <Filter className={`absolute left-3 top-2.5 h-5 w-5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                            <select
                                value={statusFilter}
                                onChange={(e) => { setPage(1); setStatusFilter(e.target.value); }}
                                className={`pl-10 pr-8 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none ${isDark
                                    ? 'bg-[#252525] border-[#333] text-white'
                                    : 'bg-white border-gray-300 text-gray-900'
                                    }`}
                            >
                                <option value="">All Statuses</option>
                                <option value="ACTIVE">Active</option>
                                <option value="INACTIVE">Inactive</option>
                                <option value="EXPIRED">Expired</option>
                            </select>
                        </div>
                        <button
                            onClick={() => fetchCodes()}
                            className={`p-2 rounded-lg transition-colors border ${isDark
                                ? 'bg-[#252525] border-[#333] text-gray-400 hover:text-white'
                                : 'bg-white border-gray-300 text-gray-600 hover:text-gray-900'
                                }`}
                        >
                            <RefreshCw size={20} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className={`overflow-hidden rounded-xl border ${isDark ? 'border-[#2a2a2a] bg-[#1e1e1e]' : 'border-gray-200 bg-white'}`}>
                {isLoading ? (
                    <div className="p-20 text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto"></div>
                        <p className={`mt-4 text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Loading promo codes...</p>
                    </div>
                ) : filteredCodes.length === 0 ? (
                    <div className="p-20 text-center">
                        <div className={`inline-block p-4 rounded-full mb-4 ${isDark ? 'bg-[#252525]' : 'bg-gray-100'}`}>
                            <Tag className={isDark ? 'text-gray-500' : 'text-gray-400'} size={32} />
                        </div>
                        <p className={`text-lg font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>No promo codes found</p>
                        <p className={`text-sm ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>Create your first discount code to get started.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className={`text-xs uppercase tracking-wider border-b ${isDark ? 'bg-[#252525] text-gray-400 border-[#2a2a2a]' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                                <tr>
                                    <th className="p-4 font-medium">Code</th>
                                    <th className="p-4 font-medium">Discount</th>
                                    <th className="p-4 font-medium">Status</th>
                                    <th className="p-4 font-medium">Usage</th>
                                    <th className="p-4 font-medium">Validity</th>
                                    <th className="p-4 font-medium text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className={`text-sm divide-y ${isDark ? 'divide-[#2a2a2a] text-gray-300' : 'divide-gray-100 text-gray-600'}`}>
                                {filteredCodes.map((code) => (
                                    <tr key={code.id} className={`group transition-colors ${isDark ? 'hover:bg-[#252525]' : 'hover:bg-gray-50'}`}>
                                        <td className="p-4">
                                            <span className="font-mono font-medium tracking-wide bg-indigo-50 text-indigo-700 px-2 py-1 rounded dark:bg-indigo-900/30 dark:text-indigo-300">
                                                {code.code}
                                            </span>
                                        </td>
                                        <td className="p-4 font-medium">
                                            {code.discountType === 'PERCENTAGE'
                                                ? `${code.discountValue}% OFF`
                                                : `$${code.discountValue} OFF`
                                            }
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium border ${code.status === 'ACTIVE'
                                                ? (isDark ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-green-50 text-green-700 border-green-100')
                                                : (isDark ? 'bg-gray-800 text-gray-400 border-gray-700' : 'bg-gray-100 text-gray-600 border-gray-200')
                                                }`}>
                                                {code.status}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            {code.usedCount || 0} / {code.maxUses || '∞'}
                                        </td>
                                        <td className="p-4 text-xs text-gray-500">
                                            <div className="flex flex-col gap-1">
                                                {code.validFrom && <span>From: {new Date(code.validFrom).toLocaleDateString()}</span>}
                                                {code.validUntil && <span>Until: {new Date(code.validUntil).toLocaleDateString()}</span>}
                                                {!code.validFrom && !code.validUntil && <span>Always Valid</span>}
                                            </div>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => setSelectedCode(code)}
                                                    className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-[#333] text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-900'}`}
                                                    title="Edit"
                                                >
                                                    <Edit size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(code.id)}
                                                    className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-red-900/20 text-red-400' : 'hover:bg-red-50 text-red-600'}`}
                                                    title="Delete"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PromoCodesView;
