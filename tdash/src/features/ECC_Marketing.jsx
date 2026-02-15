import React, { useState, useEffect } from 'react';
import { Plus, Edit3, Trash2, Search, Tag, Copy, Check } from 'lucide-react';
import api from '../lib/api';
import StatusBadge from '../components/StatusBadge';
import PromoCodeModal from './PromoCodeModal'; // Reusing existing modal

const ECC_Marketing = ({ event, isDark }) => {
    const [promoCodes, setPromoCodes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [copiedId, setCopiedId] = useState(null);

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [editingCode, setEditingCode] = useState(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [codeToDelete, setCodeToDelete] = useState(null);

    const fetchPromoCodes = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/promo-codes?eventId=${event.id}`);
            const data = res.data.data ? res.data.data.promoCodes : (res.data.promoCodes || []);
            setPromoCodes(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Failed to fetch promo codes:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPromoCodes();
    }, [event.id]);

    const handleCreate = () => {
        setEditingCode(null);
        setShowModal(true);
    };

    const handleEdit = (code) => {
        setEditingCode(code);
        setShowModal(true);
    };

    const handleDeleteClick = (code) => {
        setCodeToDelete(code);
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        if (!codeToDelete) return;
        try {
            await api.delete(`/promo-codes/${codeToDelete.id}`);
            fetchPromoCodes();
            setShowDeleteModal(false);
            setCodeToDelete(null);
        } catch (error) {
            console.error('Failed to delete promo code:', error);
            alert('Failed to delete: ' + (error.response?.data?.message || error.message));
        }
    };

    const copyToClipboard = (text, id) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h3 className={`text-lg font-medium ${isDark ? 'text-gray-100' : 'text-gray-800'}`}>Promo Codes</h3>
                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Manage discounts and promotional campaigns for this event.</p>
                </div>
                <button
                    onClick={handleCreate}
                    className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center shadow-lg transition-all ${isDark ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20'}`}
                >
                    <Plus size={16} className="mr-2" /> Create Promo Code
                </button>
            </div>

            {/* Search / Filter (Simplified for now) */}
            <div className={`relative w-full md:w-96 flex items-center px-4 py-2.5 rounded-xl border transition-colors ${isDark ? 'bg-[#1e1e1e] border-[#333] focus-within:border-indigo-500' : 'bg-white border-gray-200 focus-within:border-indigo-500 shadow-sm'}`}>
                <Search size={18} className={`mr-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                <input
                    type="text"
                    placeholder="Search codes..."
                    className={`w-full bg-transparent outline-none text-sm ${isDark ? 'text-gray-200 placeholder-gray-600' : 'text-gray-800 placeholder-gray-400'}`}
                />
            </div>

            {/* Content */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {loading ? (
                    [...Array(3)].map((_, i) => (
                        <div key={i} className={`h-40 rounded-xl animate-pulse ${isDark ? 'bg-[#1e1e1e]' : 'bg-gray-100'}`}></div>
                    ))
                ) : promoCodes.length === 0 ? (
                    <div className={`col-span-full py-12 text-center rounded-xl border border-dashed ${isDark ? 'border-[#333] bg-[#1e1e1e]/50' : 'border-gray-200 bg-gray-50'}`}>
                        <div className={`w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center ${isDark ? 'bg-[#252525] text-gray-500' : 'bg-white text-gray-400'}`}>
                            <Tag size={24} />
                        </div>
                        <h4 className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>No active promo codes</h4>
                        <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Create a code to boost ticket sales.</p>
                    </div>
                ) : (
                    promoCodes.map(code => (
                        <div key={code.id} className={`group relative p-5 rounded-2xl border transition-all hover:shadow-lg ${isDark ? 'bg-[#1e1e1e] border-[#333] hover:border-indigo-500/30' : 'bg-white border-gray-200 hover:border-indigo-200 shadow-sm'}`}>
                            <div className="flex justify-between items-start mb-4">
                                <div
                                    className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border cursor-pointer transition-colors ${isDark ? 'bg-[#252525] border-[#333] hover:bg-[#2a2a2a]' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}
                                    onClick={() => copyToClipboard(code.code, code.id)}
                                >
                                    <span className={`font-mono font-bold tracking-wide ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>{code.code}</span>
                                    {copiedId === code.id ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} className="opacity-50" />}
                                </div>
                                <StatusBadge status={code.status} isDark={isDark} />
                            </div>

                            <div className="space-y-3 mb-6">
                                <div className="flex justify-between items-baseline">
                                    <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Discount</span>
                                    <span className={`text-lg font-bold ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                                        {code.discountType === 'PERCENTAGE' ? `${code.discountValue}%` : `$${code.discountValue}`} OFF
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className={`${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Usage</span>
                                    <span className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                        {code.usesCount} / {code.maxUses || '∞'}
                                    </span>
                                </div>
                                <div className={`w-full h-1.5 rounded-full ${isDark ? 'bg-[#252525]' : 'bg-gray-100'}`}>
                                    <div
                                        className={`h-1.5 rounded-full ${isDark ? 'bg-indigo-500' : 'bg-indigo-600'}`}
                                        style={{ width: `${code.maxUses ? Math.min((code.usesCount / code.maxUses) * 100, 100) : 0}%` }}
                                    ></div>
                                </div>
                            </div>

                            <div className={`pt-4 border-t flex justify-between items-center ${isDark ? 'border-[#252525]' : 'border-gray-50'}`}>
                                <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                    {code.validUntil ? `Exp: ${new Date(code.validUntil).toLocaleDateString()}` : 'No expiry'}
                                </span>
                                <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => handleEdit(code)}
                                        className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-[#333] text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-900'}`}
                                    >
                                        <Edit3 size={14} />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteClick(code)}
                                        className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-rose-500/10 text-gray-400 hover:text-rose-500' : 'hover:bg-rose-50 text-gray-500 hover:text-rose-600'}`}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Modals */}
            {showModal && (
                <PromoCodeModal
                    promoCode={editingCode}
                    onClose={() => setShowModal(false)}
                    onSuccess={fetchPromoCodes}
                    isDark={isDark}
                    eventId={event.id}
                    organizationId={event.organizationId}
                />
            )}

            {/* Delete Confirmation */}
            {showDeleteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
                    <div className={`w-full max-w-sm p-6 rounded-xl shadow-2xl scale-100 transition-all ${isDark ? 'bg-[#1e1e1e] border border-[#333]' : 'bg-white'}`}>
                        <h3 className={`text-xl font-semibold mb-2 ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>Delete Promo Code</h3>
                        <p className={`mb-6 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            Are you sure you want to delete <strong>{codeToDelete?.code}</strong>?
                        </p>
                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={() => setShowDeleteModal(false)}
                                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${isDark ? 'text-gray-400 hover:text-white hover:bg-[#333]' : 'text-gray-600 hover:bg-gray-100'}`}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="px-4 py-2 text-sm font-medium bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors shadow-lg shadow-rose-500/20"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ECC_Marketing;
