import { orderDisplayCurrency } from './runtimeConfig';

const cell = (value) => {
    let text = String(value ?? '');
    // Quoted CSV still allows spreadsheet formula execution. Treat user values as text.
    if (/^\s*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
    return `"${text.replaceAll('"', '""')}"`;
};
export const ordersToCsv = (orders) => [
    ['Order', 'Customer', 'Email', 'Created at (UTC)', 'Status', 'Currency', 'Total', 'Tickets'],
    ...orders.map((order) => [order.orderNumber, [order.user?.firstName, order.user?.lastName].filter(Boolean).join(' '), order.user?.email, new Date(order.createdAt).toISOString(), order.status, orderDisplayCurrency(order.currency).toUpperCase(), Number(order.totalAmount).toFixed(2), order.tickets?.length ?? order._count?.tickets ?? 0]),
].map((row) => row.map(cell).join(',')).join('\r\n');
