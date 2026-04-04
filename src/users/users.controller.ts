import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Put, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from './users.schema';
import { Roles } from 'src/role/decorator/role.decorator';
import { memoryStorage } from 'multer';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsEmail, IsString, Length } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { JwtAuthGuard } from './auth/jwt.guard';
import { RolesGuard } from 'src/role/guard/role.guard';
import type { Response } from 'express';
import { TwoFactorService } from './two-factor.service';
import { TwoFactorCodeDto } from './two-factor.dto';

// DTO pour réactiver le compte
class ReactivateAccountDto {
  @IsEmail()
  email: string;

  @IsString()
  @Length(6, 6, { message: 'Code must be 6 digits' })
  code: string;
}
@Controller('api')
//@UseGuards(JwtAuthGuard, RolesGuard)

export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly twoFactorService: TwoFactorService,
  ) { }

  // create user
  @Post('/signup')
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/^image\/(jpg|jpeg|png|webp)$/)) {
          return cb(new BadRequestException('Format image invalide'), false);
        }
        cb(null, true);
      },
    }),
  )
  create(
    @Body() user: Partial<User>,
    @UploadedFile() avatar?: Express.Multer.File,
  ) {
    return this.usersService.create(user, avatar);
  }


  // get all users
  @Get('/users/all')
  findAll() {
    return this.usersService.findAll();
  }

  @Get('/users/patients')
  getPatients() {
    return this.usersService.getPatients();
  }

  @Get('/users/export/:format')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('superadmin', 'SuperAdmin', 'SUPERADMIN', 'super_admin', 'super-admin', 'super admin', 'admin')
  async exportUsers(@Param('format') format: string, @Res() res: Response) {
    const file = await this.usersService.exportUsers(format);
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.send(file.data);
  }
  // get user by id
  @Get('/users/:id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }
  // get user by email
  @Get('/users/email/:email')
  findByEmail(@Param('email') email: string) {
    return this.usersService.findByEmail(email);
  }

    @Get('/users/role/:role')
  findByRole(@Param('role') role: string) {
    return this.usersService.findByRole(role);
  }

  // update user
  @Put('/users/update/:id')
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/^image\/(jpg|jpeg|png|webp)$/)) {
          return cb(new BadRequestException('Format image invalide'), false);
        }
        cb(null, true);
      },
    }),
  )
  update(
    @Param('id') id: string,
    @Body() user: Partial<User>,
    @UploadedFile() avatar?: Express.Multer.File,
  ) {
    return this.usersService.update(id, user, avatar);
  }

  // delete user
  @Delete('/delete/:id')
  delete(@Param('id') id: string) {
    return this.usersService.delete(id);
  }

  // assign user role
  @Patch(':id/role')
  updateRole(
    @Param('id') id: string,
    @Body('roleId') roleId: string,
  ) {
    return this.usersService.updateUserRole(id, roleId);
  }

  //activate/deactivate user
  @Patch(':id/status')
  //@Roles('Admin', 'SuperAdmin')
  setStatus(
    @Param('id') id: string,
    @Body('actif') actif: boolean,
  ) {
    return this.usersService.setActiveStatus(id, actif);
  }

  @Delete('delete-all')
  // @UseGuards(AdminGuard)
  async deleteAll() {
    if (process.env.NODE_ENV === 'production') {
      throw new BadRequestException('deleteAll disabled in production');
    }
    return this.usersService.deleteAll();
  }

  @Delete('bulk/inactive')
  // @UseGuards(AdminGuard)
  async deleteSelectedInactive(@Body('ids') ids: string[]) {
    return this.usersService.deleteSelectedInactive(ids);
  }

  @Patch('bulk/disable')
  // @UseGuards(AdminGuard)
  async deleteSelectedSoft(@Body('ids') ids: string[]) {
    return this.usersService.deleteSelectedSoft(ids);
  }


  @Post('send-reactivation-code')
  async sendReactivationCode(@Body() body: { email: string }) {
    const user = await this.usersService.findByEmail(body.email);
    if (!user) throw new BadRequestException('User not found');

    return this.usersService.generateReactivationCode(user);
  }


  @Post('reactivate')
  async reactivate(@Body() body: ReactivateAccountDto) {
    const { email, code } = plainToInstance(ReactivateAccountDto, body);
    return this.usersService.reactivateAccount(email, code);
  }

  @Get('/users/me/2fa/status')
  @UseGuards(JwtAuthGuard)
  getTwoFactorStatus(@Req() req: any) {
    const userId = req?.user?.sub ?? req?.user?.userId;
    return this.twoFactorService.getStatus(userId);
  }

  @Post('/users/me/2fa/setup')
  @UseGuards(JwtAuthGuard)
  setupTwoFactor(@Req() req: any) {
    const userId = req?.user?.sub ?? req?.user?.userId;
    return this.twoFactorService.setup(userId);
  }

  @Post('/users/me/2fa/enable')
  @UseGuards(JwtAuthGuard)
  enableTwoFactor(@Req() req: any, @Body() dto: TwoFactorCodeDto) {
    const userId = req?.user?.sub ?? req?.user?.userId;
    return this.twoFactorService.enable(userId, dto.code);
  }

  @Post('/users/me/2fa/disable')
  @UseGuards(JwtAuthGuard)
  disableTwoFactor(@Req() req: any, @Body() dto: TwoFactorCodeDto) {
    const userId = req?.user?.sub ?? req?.user?.userId;
    return this.twoFactorService.disable(userId, dto.code);
  }

}
