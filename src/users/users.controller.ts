import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from './users.schema';
import { Roles } from 'src/role/decorator/role.decorator';


@Controller('api')
//@UseGuards(JwtAuthGuard, RolesGuard)

export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    // create user
    @Post('/signup')
    create(@Body() user: Partial<User>) {
        return this.usersService.create(user);
    }

    // get all users
    @Get('/users/all')
    findAll() {
        return this.usersService.findAll();
    }
    // get user by id
    @Get('/users/:id')
    findOne(@Param('id') id: string) {
        return this.usersService.findOne(id);
    }
    //get user by email
    @Get('/users/email/:email')
    findByEmail(@Param('email') email: string) {
        return this.usersService.findByEmail(email);
    }

    // update user
    @Put('/users/update/:id')
    update(@Param('id') id: string, @Body() user: Partial<User>) {
        return this.usersService.update(id, user);
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


}
