import { IsInt, Max, Min } from 'class-validator';

export class CreateOrderDto {
  @IsInt()
  @Min(1)
  @Max(5000)
  amount!: number;
}

export interface OrderResponse {
  id: string;
  amount: number;
  status: string;
  qrCode: string | null;
  alipayTradeNo: string | null;
  createdAt: string;
  paidAt: string | null;
}
