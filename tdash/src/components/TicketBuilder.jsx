import React, { useState } from 'react';
import { Plus, X, DollarSign, Users, GripVertical, AlertCircle } from 'lucide-react';

const TicketBuilder = ({ tickets, onChange, isDark }) => {
    const [isAdding, setIsAdding] = useState(false);
    // State for new ticket
    const [newTicket, setNewTicket] = useState({
        name: '',
        price: '',
        quantity: '',
        status: 'ACTIVE',
        tiers: []
    });

    // State for managing tiers within the "Add Ticket" form (if we want to add tiers at creation)
    // Or simpler: Create ticket first, then add tiers?
    // Let's allow adding tiers to EXISTING tickets in the list to keep the "Add" form simple.

    const [error, setError] = useState('');

    // State for expanding a ticket to show/edit tiers
    const [expandedTicketId, setExpandedTicketId] = useState(null);
    const [isAddingTier, setIsAddingTier] = useState(null); // ticketId
    const [newTier, setNewTier] = useState({
        name: '',
        price: '',
        quantityLimit: '',
        startsAt: '',
        endsAt: ''
    });

    const handleAdd = () => {
        if (!newTicket.name || !newTicket.price || !newTicket.quantity) {
            setError('Please fill all required fields');
            return;
        }
        onChange([...tickets, { ...newTicket, id: Date.now().toString(), tiers: [] }]);
        setNewTicket({ name: '', price: '', quantity: '', status: 'ACTIVE', tiers: [] });
        setIsAdding(false);
        setError('');
    };

    const handleRemove = (id) => {
        onChange(tickets.filter(t => t.id !== id));
    };

    // Tier Management
    const handleAddTier = (ticketId) => {
        if (!newTier.name || !newTier.price) {
            // Basic validation
            return;
        }

        const updatedTickets = tickets.map(t => {
            if (t.id === ticketId) {
                const tiers = t.tiers || [];
                return {
                    ...t,
                    tiers: [...tiers, { ...newTier, id: 'temp_' + Date.now() }]
                };
            }
            return t;
        });

        onChange(updatedTickets);
        setNewTier({ name: '', price: '', quantityLimit: '', startsAt: '', endsAt: '' });
        setIsAddingTier(null);
    };

    const handleRemoveTier = (ticketId, tierId) => {
        const updatedTickets = tickets.map(t => {
            if (t.id === ticketId) {
                return {
                    ...t,
                    tiers: t.tiers.filter(tier => tier.id !== tierId)
                };
            }
            return t;
        });
        onChange(updatedTickets);
    };

    return (
        <div className="space-y-4">
            <div className="space-y-3">
                {tickets.map((ticket, index) => (
                    <div
                        key={ticket.id || index}
                        className={`rounded-lg border overflow-hidden transition-all ${isDark ? 'bg-[#252525] border-[#333]' : 'bg-white border-gray-200'}`}
                    >
                        {/* Ticket Header */}
                        <div className="p-3 flex items-center justify-between group">
                            <div className="flex items-center space-x-3 flex-1 cursor-pointer" onClick={() => setExpandedTicketId(expandedTicketId === ticket.id ? null : ticket.id)}>
                                <GripVertical size={16} className={`cursor-grab ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
                                <div>
                                    <div className="flex items-center space-x-2">
                                        <p className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{ticket.name}</p>
                                        {(ticket.tiers && ticket.tiers.length > 0) && (
                                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-500/10 text-indigo-500 font-medium">
                                                {ticket.tiers.length} Tiers
                                            </span>
                                        )}
                                    </div>
                                    <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                        {ticket.quantity} available • ${Number(ticket.price).toFixed(2)} base
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center space-x-2">
                                <button
                                    onClick={() => setExpandedTicketId(expandedTicketId === ticket.id ? null : ticket.id)}
                                    className={`text-xs px-2 py-1 rounded transition-colors ${isDark ? 'text-gray-400 hover:bg-[#333]' : 'text-gray-500 hover:bg-gray-100'}`}
                                >
                                    {expandedTicketId === ticket.id ? 'Hide Tiers' : 'Manage Tiers'}
                                </button>
                                <button
                                    onClick={() => handleRemove(ticket.id)}
                                    className={`opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-rose-500/10 hover:text-rose-500 transition-all ${isDark ? 'text-gray-600' : 'text-gray-400'}`}
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>

                        {/* Tiers Section (Expandable) */}
                        {expandedTicketId === ticket.id && (
                            <div className={`p-3 border-t text-sm ${isDark ? 'border-[#333] bg-[#1a1a1a]' : 'border-gray-100 bg-gray-50/50'}`}>
                                <div className="space-y-2 mb-3">
                                    <p className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Pricing Tiers</p>

                                    {(!ticket.tiers || ticket.tiers.length === 0) && (
                                        <p className="text-xs text-gray-400 italic">No special pricing tiers added.</p>
                                    )}

                                    {ticket.tiers && ticket.tiers.map((tier, idx) => (
                                        <div key={idx} className={`flex items-center justify-between p-2 rounded border ${isDark ? 'bg-[#252525] border-[#333]' : 'bg-white border-gray-200'}`}>
                                            <div>
                                                <span className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{tier.name}</span>
                                                <span className="mx-2 text-gray-400">•</span>
                                                <span className="font-mono">${tier.price}</span>
                                                {tier.quantityLimit && <span className="text-xs text-gray-500 ml-2">(Limit: {tier.quantityLimit})</span>}
                                            </div>
                                            <button onClick={() => handleRemoveTier(ticket.id, tier.id)} className="text-gray-400 hover:text-rose-500">
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                {/* Add Tier Form */}
                                {isAddingTier === ticket.id ? (
                                    <div className={`p-3 rounded border animate-fade-in ${isDark ? 'bg-[#2a2a2a] border-[#333]' : 'bg-white border-gray-200'}`}>
                                        <div className="grid grid-cols-2 gap-2 mb-2">
                                            <input
                                                type="text"
                                                placeholder="Tier Name (e.g. Early Bird)"
                                                value={newTier.name}
                                                onChange={e => setNewTier({ ...newTier, name: e.target.value })}
                                                className={`w-full px-2 py-1.5 rounded text-xs outline-none border ${isDark ? 'bg-[#1e1e1e] border-[#333] text-white' : 'bg-white border-gray-300'}`}
                                            />
                                            <input
                                                type="number"
                                                placeholder="Price ($)"
                                                value={newTier.price}
                                                onChange={e => setNewTier({ ...newTier, price: e.target.value })}
                                                className={`w-full px-2 py-1.5 rounded text-xs outline-none border ${isDark ? 'bg-[#1e1e1e] border-[#333] text-white' : 'bg-white border-gray-300'}`}
                                            />
                                            <input
                                                type="number"
                                                placeholder="Qty Limit (Optional)"
                                                value={newTier.quantityLimit}
                                                onChange={e => setNewTier({ ...newTier, quantityLimit: e.target.value })}
                                                className={`w-full px-2 py-1.5 rounded text-xs outline-none border ${isDark ? 'bg-[#1e1e1e] border-[#333] text-white' : 'bg-white border-gray-300'}`}
                                            />
                                            <input
                                                type="datetime-local"
                                                placeholder="Starts At"
                                                value={newTier.startsAt}
                                                onChange={e => setNewTier({ ...newTier, startsAt: e.target.value })}
                                                className={`w-full px-2 py-1.5 rounded text-xs outline-none border ${isDark ? 'bg-[#1e1e1e] border-[#333] text-white' : 'bg-white border-gray-300'}`}
                                            />
                                            <input
                                                type="datetime-local"
                                                placeholder="Ends At"
                                                value={newTier.endsAt}
                                                onChange={e => setNewTier({ ...newTier, endsAt: e.target.value })}
                                                className={`w-full px-2 py-1.5 rounded text-xs outline-none border ${isDark ? 'bg-[#1e1e1e] border-[#333] text-white' : 'bg-white border-gray-300'}`}
                                            />
                                        </div>
                                        <div className="flex justify-end space-x-2">
                                            <button
                                                onClick={() => setIsAddingTier(null)}
                                                className={`text-xs px-2 py-1 rounded ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-800'}`}
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={() => handleAddTier(ticket.id)}
                                                className="text-xs px-2 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                                            >
                                                Save Tier
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setIsAddingTier(ticket.id)}
                                        className={`text-xs flex items-center font-medium ${isDark ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-700'}`}
                                    >
                                        <Plus size={12} className="mr-1" /> Add Pricing Tier
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {isAdding ? (
                <div className={`p-4 rounded-lg border animate-fade-in ${isDark ? 'bg-[#2a2a2a] border-[#333]' : 'bg-gray-50 border-gray-200'}`}>
                    {error && (
                        <div className="mb-3 text-xs text-rose-500 flex items-center">
                            <AlertCircle size={12} className="mr-1" /> {error}
                        </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                        <input
                            type="text"
                            placeholder="Ticket Name (e.g. VIP)"
                            value={newTicket.name}
                            onChange={(e) => setNewTicket({ ...newTicket, name: e.target.value })}
                            className={`px-3 py-2 rounded-md outline-none border text-sm ${isDark ? 'bg-[#1e1e1e] border-[#333] text-white' : 'bg-white border-gray-300 text-gray-900'
                                }`}
                            autoFocus
                        />
                        <div className="relative">
                            <DollarSign size={14} className={`absolute left-3 top-2.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                            <input
                                type="number"
                                placeholder="Price"
                                value={newTicket.price}
                                onChange={(e) => setNewTicket({ ...newTicket, price: e.target.value })}
                                className={`w-full pl-8 pr-3 py-2 rounded-md outline-none border text-sm ${isDark ? 'bg-[#1e1e1e] border-[#333] text-white' : 'bg-white border-gray-300 text-gray-900'
                                    }`}
                            />
                        </div>
                        <div className="relative">
                            <Users size={14} className={`absolute left-3 top-2.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                            <input
                                type="number"
                                placeholder="Quantity"
                                value={newTicket.quantity}
                                onChange={(e) => setNewTicket({ ...newTicket, quantity: e.target.value })}
                                className={`w-full pl-8 pr-3 py-2 rounded-md outline-none border text-sm ${isDark ? 'bg-[#1e1e1e] border-[#333] text-white' : 'bg-white border-gray-300 text-gray-900'
                                    }`}
                            />
                        </div>
                    </div>
                    <div className="flex justify-end space-x-2">
                        <button
                            onClick={() => setIsAdding(false)}
                            className={`px-3 py-1.5 text-xs font-medium rounded hover:bg-transparent transition-colors ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-800'
                                }`}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleAdd}
                            className="px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors shadow-sm"
                        >
                            Add Ticket
                        </button>
                    </div>
                </div>
            ) : (
                <button
                    onClick={() => setIsAdding(true)}
                    className={`w-full py-3 rounded-lg border-2 border-dashed flex items-center justify-center text-sm font-medium transition-all ${isDark
                        ? 'border-[#333] text-gray-400 hover:border-indigo-500/50 hover:text-indigo-400 hover:bg-[#252525]'
                        : 'border-gray-200 text-gray-500 hover:border-indigo-200 hover:text-indigo-600 hover:bg-indigo-50'
                        }`}
                >
                    <Plus size={16} className="mr-2" /> Add Ticket Type
                </button>
            )}
        </div>
    );
};

export default TicketBuilder;
