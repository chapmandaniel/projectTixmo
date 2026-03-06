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
                    <h2 className={`text-3xl font-light tracking-tight ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>Promo Codes</h2>
                    <p className={`mt-1 text-lg font-light ${isDark ? 'text-[#a1a5b7]' : 'text-gray-500'}`}>
                        Manage discounts and promotional campaigns.
                    </p>
                </div>
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="flex items-center justify-center space-x-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-orange-400 hover:from-pink-600 hover:to-orange-500 shadow-md shadow-pink-500/20 text-white rounded-md transition-colors font-light tracking-wide text-sm"
                >
                    <Plus size={18} />
                    <span>Create Promo Code</span>
                </button>
            </div>

            {/* Controls */}
            <div className={`p-4 rounded-md border ${isDark ? 'bg-[#1e1e2d] border-[#2b2b40]' : 'bg-white border-gray-200'}`}>
                <div className="flex flex-col md:flex-row gap-4 justify-between">
                    <div className="flex-1 relative">
                        <Search className={`absolute left-3 top-2.5 h-5 w-5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                        <input
                            type="text"
                            placeholder="Search by Code..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className={`w-full pl-10 pr-4 py-2 rounded-md border focus:outline-none focus:ring-2 focus:ring-pink-500 font-light tracking-wide ${isDark
                                ? 'bg-[#151521] border-[#2b2b40] text-gray-200 placeholder-gray-500'
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
                                className={`pl-10 pr-8 py-2 rounded-md border focus:outline-none focus:ring-2 focus:ring-pink-500 appearance-none font-light tracking-wide ${isDark
                                    ? 'bg-[#151521] border-[#2b2b40] text-gray-200'
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
                            className={`p-2 rounded-md transition-colors border ${isDark
                                ? 'bg-[#151521] border-[#2b2b40] text-gray-400 hover:bg-[#232336] hover:text-gray-200 hover:border-[#3a3a5a]'
                                : 'bg-white border-gray-300 text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                }`}
                        >
                            <RefreshCw size={20} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className={`overflow-hidden rounded-md border ${isDark ? 'border-[#2b2b40] bg-[#1e1e2d]' : 'border-gray-200 bg-white'}`}>
                {isLoading ? (
                    <div className="p-20 text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500 mx-auto"></div>
                        <p className={`mt-4 text-sm font-light ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Loading promo codes...</p>
                    </div>
                ) : filteredCodes.length === 0 ? (
                    <div className="p-20 text-center">
                        <div className={`inline-block p-4 rounded-full mb-4 ${isDark ? 'bg-[#2b2b40]' : 'bg-gray-100'}`}>
                            <Tag className={isDark ? 'text-gray-500' : 'text-gray-400'} size={32} />
                        </div>
                        <p className={`text-lg font-light ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>No promo codes found</p>
                        <p className={`text-sm font-light ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>Create your first discount code to get started.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left font-light">
                            <thead className={`text-xs uppercase tracking-wider border-b ${isDark ? 'bg-[#2b2b40] text-[#a1a5b7] border-[#3a3a5a]' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                                <tr>
                                    <th className="p-4 font-light tracking-wide">Code</th>
                                    <th className="p-4 font-light tracking-wide">Discount</th>
                                    <th className="p-4 font-light tracking-wide">Status</th>
                                    <th className="p-4 font-light tracking-wide">Usage</th>
                                    <th className="p-4 font-light tracking-wide">Validity</th>
                                    <th className="p-4 font-light tracking-wide text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className={`text-sm divide-y font-light tracking-wide ${isDark ? 'divide-[#2b2b40] text-gray-300' : 'divide-gray-100 text-gray-600'}`}>
                                {filteredCodes.map((code) => (
                                    <tr key={code.id} className={`group transition-colors ${isDark ? 'hover:bg-[#232336]' : 'hover:bg-gray-50'}`}>
                                        <td className="p-4">
                                            <span className="font-mono tracking-wide bg-indigo-50 text-indigo-700 px-2 py-1 rounded-sm dark:bg-pink-500/10 dark:text-pink-400">
                                                {code.code}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            {code.discountType === 'PERCENTAGE'
                                                ? `${code.discountValue}% OFF`
                                                : `$${code.discountValue} OFF`
                                            }
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded-sm text-xs border ${code.status === 'ACTIVE'
                                                ? (isDark ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-green-50 text-green-700 border-green-100')
                                                : (isDark ? 'bg-gray-800 text-gray-400 border-gray-700' : 'bg-gray-100 text-gray-600 border-gray-200')
                                                }`}>
                                                {code.status}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            {code.usedCount || 0} / {code.maxUses || '∞'}
                                        </td>
                                        <td className="p-4 text-xs font-light text-[#a1a5b7]">
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
                                                    className={`p-2 rounded-md transition-colors ${isDark ? 'hover:bg-[#333] text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-900'}`}
                                                    title="Edit"
                                                >
                                                    <Edit size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(code.id)}
                                                    className={`p-2 rounded-md transition-colors ${isDark ? 'hover:bg-red-900/20 text-red-400' : 'hover:bg-red-50 text-red-600'}`}
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
