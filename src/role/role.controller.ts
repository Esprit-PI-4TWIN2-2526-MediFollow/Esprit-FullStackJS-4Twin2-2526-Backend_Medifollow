import { Body, Controller, Delete, Get, Param, Put, Post, UseGuards } from '@nestjs/common';
import { RoleService } from './role.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { JwtAuthGuard } from 'src/users/auth/jwt.guard';
import { RolesGuard } from './guard/role.guard';
import { Roles } from './decorator/role.decorator';

@Controller('roles')
@UseGuards(JwtAuthGuard, RolesGuard) 
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Post()
  @Roles('superadmin')
  create(@Body() dto: CreateRoleDto) {
    return this.roleService.create(dto);
  }

  @Get()
  @Roles('superadmin')
  findAll() {
    return this.roleService.findAll();
  }

  @Get(':id')
  @Roles('superadmin')
  findOne(@Param('id') id: string) {
    return this.roleService.findOne(id);
  }

  @Put(':id')
  @Roles('superadmin')
  update(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.roleService.update(id, dto);
  }

  @Delete(':id')
  @Roles('superadmin')
  remove(@Param('id') id: string) {
    return this.roleService.remove(id);
  }
}