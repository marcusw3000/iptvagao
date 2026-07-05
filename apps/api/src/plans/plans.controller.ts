import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { PlansService } from './plans.service'
import { CreatePlanDto, UpdatePlanDto } from './dto/create-plan.dto'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'

@Controller('plans')
@UseGuards(JwtAuthGuard)
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Get()
  findAll(@Query('all') all?: string) {
    return this.plansService.findAll(all === 'true')
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.plansService.findOne(id)
  }

  @Post()
  create(@Body() dto: CreatePlanDto) {
    return this.plansService.create(dto)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePlanDto) {
    return this.plansService.update(id, dto)
  }

  @Patch(':id/deactivate')
  deactivate(@Param('id') id: string) {
    return this.plansService.deactivate(id)
  }

  @Patch(':id/activate')
  activatePlan(@Param('id') id: string) {
    return this.plansService.activatePlan(id)
  }
}
