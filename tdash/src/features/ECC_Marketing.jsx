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
                    <h3 className={`text-xl font-light tracking-tight ${isDark ? 'text-gray-100' : 'text-gray-800'}`}>Promo Codes</h3>
                    <p className={`text-sm font-light tracking-wide ${isDark ? 'text-[#a1a5b7]' : 'text-gray-500'}`}>Manage discounts and promotional campaigns for this event.</p>
                </div>
                <button
                    onClick={handleCreate}
                    className={`px-4 py-2 text-sm font-light tracking-wide rounded-md flex items-center shadow-lg transition-all ${isDark ? 'bg-gradient-to-r from-pink-500 to-orange-400 hover:from-pink-400 hover:to-orange-300 text-white shadow-pink-500/20' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20'}`}
                >
                    <Plus size={16} className="mr-2" /> Create Promo Code
                </button>
            </div>

            {/* Search / Filter (Simplified for now) */}
            <div className={`relative w-full md:w-96 flex items-center px-4 py-2.5 rounded-md border transition-colors ${isDark ? 'bg-[#1e1e2d] border-[#2b2b40]/60 focus-within:border-pink-500' : 'bg-white border-gray-200/60 focus-within:border-indigo-500 shadow-sm'}`}>
                <Search size={18} className={`mr-3 ${isDark ? 'text-[#a1a5b7]' : 'text-gray-400'}`} />
                <input
                    type="text"
                    placeholder="Search codes..."
                    className={`w-full bg-transparent outline-none text-sm font-light tracking-wide ${isDark ? 'text-gray-200 placeholder-[#5a5c6e]' : 'text-gray-800 placeholder-gray-400'}`}
                />
            </div>

            {/* Content */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {loading ? (
                    [...Array(3)].map((_, i) => (
                        <div key={i} className={`h-40 rounded-md animate-pulse ${isDark ? 'bg-[#1e1e2d]' : 'bg-gray-100'}`}></div>
                    ))
                ) : promoCodes.length === 0 ? (
                    <div className={`col-span-full py-12 text-center rounded-md border border-dashed ${isDark ? 'border-[#2b2b40]/60 bg-[#1e1e2d]/50' : 'border-gray-200/60 bg-gray-50'}`}>
                        <div className={`w-12 h-12 rounded-md mx-auto mb-3 flex items-center justify-center ${isDark ? 'bg-[#232336] text-gray-500' : 'bg-white text-gray-400'}`}>
                            <Tag size={24} />
                        </div>
                        <h4 className={`text-sm font-normal tracking-wide ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>No active promo codes</h4>
                        <p className={`text-xs mt-1 font-light ${isDark ? 'text-[#a1a5b7]' : 'text-gray-500'}`}>Create a code to boost ticket sales.</p>
                    </div>
                ) : (
                    promoCodes.map(code => (
                        <div key={code.id} className={`group relative p-5 rounded-md border transition-all hover:shadow-lg ${isDark ? 'bg-[#1e1e2d] border-[#2b2b40]/60 hover:border-pink-500/30' : 'bg-white border-gray-200/60 hover:border-indigo-200 shadow-sm'}`}>
                            <div className="flex justify-between items-start mb-4">
                                <div
                                    className={`flex items-center space-x-2 px-3 py-1.5 rounded-md border cursor-pointer transition-colors ${isDark ? 'bg-[#151521] border-[#2b2b40]/60 hover:bg-[#232336]' : 'bg-gray-50 border-gray-200/60 hover:bg-gray-100'}`}
                                    onClick={() => copyToClipboard(code.code, code.id)}
                                >
                                    <span className={`font-mono font-light tracking-wide ${isDark ? 'text-pink-400' : 'text-indigo-600'}`}>{code.code}</span>
                                    {copiedId === code.id ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} className="opacity-50" />}
                                </div>
                                <StatusBadge status={code.status} isDark={isDark} />
                            </div>

                            <div className="space-y-3 mb-6">
                                <div className="flex justify-between items-baseline">
                                    <span className={`text-sm font-light ${isDark ? 'text-[#a1a5b7]' : 'text-gray-500'}`}>Discount</span>
                                    <span className={`text-lg font-normal tracking-tight ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                                        {code.discountType === 'PERCENTAGE' ? `${code.discountValue}%` : `$${code.discountValue}`} OFF
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-xs font-light tracking-wide">
                                    <span className={`${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Usage</span>
                                    <span className={`font-normal ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                        {code.usesCount} / {code.maxUses || '∞'}
                                    </span>
                                </div>
                                <div className={`w-full h-1.5 rounded-full border ${isDark ? 'bg-[#151521] border-[#2b2b40]/60' : 'bg-gray-100 border-transparent'}`}>
                                    <div
                                        className={`h-1.5 rounded-full ${isDark ? 'bg-gradient-to-r from-pink-500 to-orange-400' : 'bg-indigo-600'}`}
                                        style={{ width: `${code.maxUses ? Math.min((code.usesCount / code.maxUses) * 100, 100) : 0}%` }}
                                    ></div>
                                </div>
                            </div>

                            <div className={`pt-4 border-t flex justify-between items-center ${isDark ? 'border-[#2b2b40]/60' : 'border-gray-50'}`}>
                                <span className={`text-xs font-light tracking-wide ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                    {code.validUntil ? `Exp: ${new Date(code.validUntil).toLocaleDateString()}` : 'No expiry'}
                                </span>
                                <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => handleEdit(code)}
                                        className={`p-2 rounded-md transition-colors ${isDark ? 'hover:bg-[#232336] text-[#a1a5b7] hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-900'}`}
                                    >
                                        <Edit3 size={14} />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteClick(code)}
                                        className={`p-2 rounded-md transition-colors ${isDark ? 'hover:bg-rose-500/10 text-[#a1a5b7] hover:text-rose-500' : 'hover:bg-rose-50 text-gray-500 hover:text-rose-600'}`}
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
                    <div className={`w-full max-w-sm p-6 rounded-md shadow-2xl scale-100 transition-all ${isDark ? 'bg-[#151521] border border-[#2b2b40]/60' : 'bg-white'}`}>
                        <h3 className={`text-xl font-light tracking-tight mb-2 ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>Delete Promo Code</h3>
                        <p className={`mb-6 text-sm font-light tracking-wide ${isDark ? 'text-[#a1a5b7]' : 'text-gray-600'}`}>
                            Are you sure you want to delete <strong className="font-normal text-gray-200">{codeToDelete?.code}</strong>?
                        </p>
                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={() => setShowDeleteModal(false)}
                                className={`px-4 py-2 text-sm font-light tracking-wide rounded-md transition-colors border ${isDark ? 'text-[#a1a5b7] hover:text-gray-200 hover:bg-[#232336] border-[#2b2b40]/60' : 'text-gray-600 hover:bg-gray-100'}`}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="px-4 py-2 text-sm font-light tracking-wide bg-rose-600 text-white rounded-md hover:bg-rose-700 transition-colors shadow-lg shadow-rose-500/20"
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
