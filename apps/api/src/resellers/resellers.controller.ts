import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { ResellersService } from './resellers.service'
import { CreateResellerDto } from './dto/create-reseller.dto'
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { PaginationDto } from '../common/dto/pagination.dto'

@Controller('resellers')
@UseGuards(JwtAuthGuard)
export class ResellersController {
  constructor(private readonly resellersService: ResellersService) {}

  @Post()
  create(@Body() dto: CreateResellerDto) {
    return this.resellersService.create(dto)
  }

  @Get()
  findAll(@Query() pagination: PaginationDto) {
    return this.resellersService.findAll({
      page: pagination.page ?? 1,
      limit: pagination.limit ?? 20,
    })
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.resellersService.findOne(id)
  }

  @Patch(':id/suspend')
  suspend(@Param('id') id: string) {
    return this.resellersService.suspend(id)
  }

  @Patch(':id/activate')
  activate(@Param('id') id: string) {
    return this.resellersService.activate(id)
  }

  @Get(':id/commissions')
  findCommissions(@Param('id') id: string, @Query() pagination: PaginationDto) {
    return this.resellersService.findCommissions(id, {
      page: pagination.page ?? 1,
      limit: pagination.limit ?? 20,
    })
  }

  @Post(':id/withdrawals')
  requestWithdrawal(
    @Param('id') id: string,
    @Body() dto: CreateWithdrawalDto,
  ) {
    return this.resellersService.requestWithdrawal(id, dto)
  }

  @Get(':id/withdrawals')
  findWithdrawals(@Param('id') id: string, @Query() pagination: PaginationDto) {
    return this.resellersService.findWithdrawals(id, {
      page: pagination.page ?? 1,
      limit: pagination.limit ?? 20,
    })
  }

  @Patch(':id/withdrawals/:wid/approve')
  approveWithdrawal(@Param('id') id: string, @Param('wid') wid: string) {
    return this.resellersService.approveWithdrawal(id, wid)
  }

  @Patch(':id/withdrawals/:wid/reject')
  rejectWithdrawal(@Param('id') id: string, @Param('wid') wid: string) {
    return this.resellersService.rejectWithdrawal(id, wid)
  }
}
