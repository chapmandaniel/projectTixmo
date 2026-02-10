import React, { useState } from 'react';
import { X, Calendar, User, CreditCard, Mail, Phone, ShoppingBag, AlertTriangle, CheckCircle } from 'lucide-react';
import api from '../lib/api';

const OrderDetailModal = ({ order, onClose, isDark, onOrderUpdated }) => {
    const [isRefunding, setIsRefunding] = useState(false);
    const [refundError, setRefundError] = useState(null);
    const [showRefundConfirm, setShowRefundConfirm] = useState(false);
    if (!order) return null;

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleString();
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    };

    const handleRefund = async () => {
        setIsRefunding(true);
        setRefundError(null);
        try {
            await api.post(`/orders/${order.id}/refund`);
            if (onOrderUpdated) onOrderUpdated();
            onClose();
        } catch (error) {
            console.error('Refund failed:', error);
            setRefundError(error.response?.data?.message || 'Failed to refund order');
            setIsRefunding(false);
            setShowRefundConfirm(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className={`w-full max-w-2xl transform rounded-2xl shadow-2xl transition-all ${isDark ? 'bg-[#1e1e1e] border border-[#2a2a2a]' : 'bg-white'}`}>

                {/* Header */}
                <div className={`flex items-center justify-between p-6 border-b ${isDark ? 'border-[#2a2a2a]' : 'border-gray-100'}`}>
                    <div>
                        <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            Order #{order.orderNumber}
                        </h2>
                        <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            Placed on {formatDate(order.createdAt)}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className={`p-2 rounded-full transition-colors ${isDark ? 'hover:bg-[#2a2a2a] text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">

                    {/* Status Banner */}
                    <div className={`flex items-center justify-between p-4 rounded-lg ${order.status === 'PAID'
                        ? (isDark ? 'bg-green-500/10 text-green-400' : 'bg-green-50 text-green-700')
                        : (isDark ? 'bg-yellow-500/10 text-yellow-400' : 'bg-yellow-50 text-yellow-700')
                        }`}>
                        <div className="flex items-center space-x-2">
                            <span className="font-medium">Status:</span>
                            <span className="font-bold">{order.status}</span>
                        </div>
                        <div className="text-sm opacity-80">
                            {order.paymentStatus}
                        </div>
                    </div>

                    {/* Customer Info */}
                    <div>
                        <h3 className={`text-sm font-medium uppercase tracking-wider mb-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            Customer Details
                        </h3>
                        <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl ${isDark ? 'bg-[#252525]' : 'bg-gray-50'}`}>
                            <div className="flex items-start space-x-3">
                                <User className={`mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} size={18} />
                                <div>
                                    <p className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                                        {order.user?.firstName} {order.user?.lastName}
                                    </p>
                                    <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Customer</p>
                                </div>
                            </div>
                            <div className="flex items-start space-x-3">
                                <Mail className={`mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} size={18} />
                                <div>
                                    <p className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                                        {order.user?.email}
                                    </p>
                                    <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Email</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Event & Tickets */}
                    <div>
                        <h3 className={`text-sm font-medium uppercase tracking-wider mb-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            Order Items
                        </h3>
                        <div className={`border rounded-xl overflow-hidden ${isDark ? 'border-[#2a2a2a]' : 'border-gray-200'}`}>
                            {/* Event Header */}
                            <div className={`p-4 border-b ${isDark ? 'bg-[#252525] border-[#2a2a2a]' : 'bg-gray-50 border-gray-200'}`}>
                                <div className="flex items-center space-x-3">
                                    <div className={`p-2 rounded-lg ${isDark ? 'bg-[#2a2a2a] text-indigo-400' : 'bg-white text-indigo-600'}`}>
                                        <Calendar size={20} />
                                    </div>
                                    <div>
                                        <h4 className={`font-medium ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                                            {order.event?.name}
                                        </h4>
                                        <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                            Event ID: {order.eventId?.split('-')[0]}...
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Ticket List */}
                            <div className={`divide-y ${isDark ? 'divide-[#2a2a2a]' : 'divide-gray-100'}`}>
                                {order.tickets?.map((ticket, idx) => (
                                    <div key={ticket.id} className="p-4 flex items-center justify-between">
                                        <div className="flex items-center space-x-4">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-medium text-xs ${isDark ? 'bg-[#2a2a2a] text-gray-400' : 'bg-gray-100 text-gray-600'}`}>
                                                {idx + 1}
                                            </div>
                                            <div>
                                                <p className={`font-medium ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                                                    {ticket.ticketType?.name || 'General Admission'}
                                                </p>
                                                <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                                    Barcode: {ticket.barcode || 'Generating...'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className={`font-medium ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                                            {formatCurrency(ticket.pricePaid || 0)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Financial Summary */}
                    <div className="flex justify-end">
                        <div className={`w-full md:w-1/2 space-y-3 p-4 rounded-xl ${isDark ? 'bg-[#252525]' : 'bg-gray-50'}`}>
                            <div className="flex justify-between text-sm">
                                <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>Subtotal</span>
                                <span className={isDark ? 'text-gray-200' : 'text-gray-900'}>{formatCurrency(order.totalAmount - (order.feesAmount || 0) - (order.taxAmount || 0))}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>Fees</span>
                                <span className={isDark ? 'text-gray-200' : 'text-gray-900'}>{formatCurrency(order.feesAmount || 0)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>Tax</span>
                                <span className={isDark ? 'text-gray-200' : 'text-gray-900'}>{formatCurrency(order.taxAmount || 0)}</span>
                            </div>
                            <div className={`pt-3 border-t flex justify-between font-bold text-lg ${isDark ? 'border-[#333] text-white' : 'border-gray-200 text-gray-900'}`}>
                                <span>Total</span>
                                <span>{formatCurrency(order.totalAmount)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Action Bar */}
                <div className={`p-6 border-t flex justify-end space-x-3 ${isDark ? 'border-[#2a2a2a]' : 'border-gray-100'}`}>
                    <button
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isDark
                            ? 'bg-[#2a2a2a] text-gray-300 hover:bg-[#333]'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                    >
                        Resend Receipt
                    </button>
                    {order.status === 'PAID' && (
                        <button
                            onClick={() => setShowRefundConfirm(true)}
                            disabled={showRefundConfirm || isRefunding}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isDark
                                ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                                : 'bg-red-50 text-red-600 hover:bg-red-100'
                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                            Refund Order
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default OrderDetailModal;
