jest.mock('../src/config/prisma', () => ({__esModule:true,default: {order:{findFirst:jest.fn()},$transaction:jest.fn()}}));
jest.mock('../src/utils/notificationService', () => ({notificationService:{}}));
jest.mock('../src/api/promo-codes/service', () => ({promoCodeService:{}}));
jest.mock('../src/api/ticket-tiers/service', () => ({ticketTierService:{}}));
import prisma from '../src/config/prisma';
import {OrderService} from '../src/api/orders/service';
const svc = new OrderService();
const pending = {id:'o', status:'PENDING',tickets:[{ticketTypeId:'t'},{ticketTypeId:'t'}]};
function txFor(order:any=pending,count=1):any {return {order:{findFirst:jest.fn().mockResolvedValue(order),updateMany:jest.fn().mockResolvedValue({count}),findUniqueOrThrow:jest.fn().mockResolvedValue({id:'o',status:'PAID',tickets:[]})},ticketType:{updateMany:jest.fn().mockResolvedValue({count:1})}};}
beforeEach(()=>jest.clearAllMocks());
test('default rereads scoped supplied client, aggregates inventory, preserves response and never nests transaction',async()=>{const tx=txFor();const scope={userId:'buyer'};const result=await svc.confirmOrderInTransaction(tx,'o',scope);expect(tx.order.findFirst).toHaveBeenCalledWith({where:{id:'o',...scope},include:{tickets:true}});expect(tx.order.updateMany).toHaveBeenCalledWith({where:{id:'o',...scope,status:'PENDING'},data:{status:'PAID',paymentStatus:'SUCCEEDED'}});expect(tx.ticketType.updateMany).toHaveBeenCalledWith({where:{id:'t',quantityHeld:{gte:2}},data:{quantityHeld:{decrement:2},quantitySold:{increment:2}}});expect(result.status).toBe('PAID');expect(prisma.$transaction).not.toHaveBeenCalled();expect(prisma.order.findFirst).not.toHaveBeenCalled();});
test.each([[null,404],[{status:'CANCELLED'},400]])('internal reread error contract %p',async(order,code)=>{const tx=txFor(order);await expect(svc.confirmOrderInTransaction(tx,'o')).rejects.toMatchObject({statusCode:code});expect(tx.order.updateMany).not.toHaveBeenCalled();});
test('lost CAS performs no inventory or response work',async()=>{const tx=txFor(pending,0);await expect(svc.confirmOrderInTransaction(tx,'o')).rejects.toMatchObject({statusCode:400});expect(tx.ticketType.updateMany).not.toHaveBeenCalled();expect(tx.order.findUniqueOrThrow).not.toHaveBeenCalled();});
test('public snapshot avoids reread while retaining CAS',async()=>{const tx=txFor(null);await svc.confirmOrderInTransaction(tx,'o',{},pending as any);expect(tx.order.findFirst).not.toHaveBeenCalled();expect(tx.order.updateMany).toHaveBeenCalledTimes(1);});
