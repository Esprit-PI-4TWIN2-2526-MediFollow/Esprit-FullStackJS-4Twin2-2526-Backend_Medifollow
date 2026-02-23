import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from './users.schema';

@Controller('api')
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
    @Patch(':id/role')
    updateRole(
        @Param('id') id: string,
        @Body('roleId') roleId: string,
    ) {
        return this.usersService.updateUserRole(id, roleId);
    }

}
