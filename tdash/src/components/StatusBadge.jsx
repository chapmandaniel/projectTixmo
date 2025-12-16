import React from 'react';
import { API_ENUMS } from '../data/mockData';

const StatusBadge = ({ status, isDark }) => {
    const lightStyles = {
        [API_ENUMS.EventStatus.ON_SALE]: 'bg-emerald-50 text-emerald-700',
        [API_ENUMS.EventStatus.PUBLISHED]: 'bg-blue-50 text-blue-700',
        [API_ENUMS.EventStatus.DRAFT]: 'bg-gray-100 text-gray-600',
        [API_ENUMS.EventStatus.SOLD_OUT]: 'bg-rose-50 text-rose-700',
        [API_ENUMS.OrderStatus.PAID]: 'bg-emerald-50 text-emerald-700',
        [API_ENUMS.OrderStatus.PENDING]: 'bg-amber-50 text-amber-700',
        [API_ENUMS.OrderStatus.CANCELLED]: 'bg-gray-50 text-gray-500',
        'ACTIVE': 'bg-emerald-50 text-emerald-700',
        'SUSPENDED': 'bg-rose-50 text-rose-700',
        'PENDING': 'bg-amber-50 text-amber-700',
    };

    const darkStyles = {
        [API_ENUMS.EventStatus.ON_SALE]: 'bg-emerald-900/10 text-emerald-400/80',
        [API_ENUMS.EventStatus.PUBLISHED]: 'bg-blue-900/10 text-blue-400/80',
        [API_ENUMS.EventStatus.DRAFT]: 'bg-[#2a2a2a] text-gray-400',
        [API_ENUMS.EventStatus.SOLD_OUT]: 'bg-rose-900/10 text-rose-400/80',
        [API_ENUMS.OrderStatus.PAID]: 'bg-emerald-900/10 text-emerald-400/80',
        [API_ENUMS.OrderStatus.PENDING]: 'bg-amber-900/10 text-amber-400/80',
        [API_ENUMS.OrderStatus.CANCELLED]: 'bg-[#2a2a2a] text-gray-500',
        'ACTIVE': 'bg-emerald-900/10 text-emerald-400/80',
        'SUSPENDED': 'bg-rose-900/10 text-rose-400/80',
        'PENDING': 'bg-amber-900/10 text-amber-400/80',
    };

    const styles = isDark ? darkStyles : lightStyles;
    const formatStatus = (str) => str ? str.replace('_', ' ').toLowerCase() : '';

    return (
        <span className={`px-2.5 py-1 rounded-full text-xs font-normal capitalize ${styles[status] || (isDark ? 'bg-[#2a2a2a]' : 'bg-gray-50')}`}>
            {formatStatus(status)}
        </span>
    );
};

export default StatusBadge;
