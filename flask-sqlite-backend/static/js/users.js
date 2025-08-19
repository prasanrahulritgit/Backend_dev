
    $(document).ready(function() {
        // Initialize DataTable
        const table = $('#usersTable').DataTable({
            order: [[0, 'asc']],
            pageLength: 25,
            responsive: true
        });
 
        // Filter handlers
        $('#userIdFilter').on('keyup', function() {
            table.column(0).search(this.value).draw();
        });
 
        $('#usernameFilter').on('keyup', function() {
            table.column(1).search(this.value).draw();
        });
 
        $('#roleFilter').on('change', function() {
            table.column(3).search(this.value).draw();
        });
 
        // CSRF setup
        $.ajaxSetup({
            beforeSend: function(xhr, settings) {
                if (!/^(GET|HEAD|OPTIONS|TRACE)$/i.test(settings.type)) {
                    const token = $('meta[name="csrf-token"]').attr('content');
                    if (token) xhr.setRequestHeader("X-CSRFToken", token);
                }
            }
        });
 
        // Edit user handler
        $(document).on('click', '.edit-user', function() {
            const userId = $(this).data('user-id');
            const modal = $('#editUserModal');
            
            $('#editUserBody').html(`
                <div class="text-center py-4">
                    <div class="spinner-border text-primary" role="status">
                        <span class="sr-only">Loading...</span>
                    </div>
                    <p class="mt-2">Loading user details...</p>
                </div>
            `);
            
            modal.modal('show');
            $('#editUserForm').attr('action', `/users/update/${userId}`);
 
            $.ajax({
                url: `/users/edit/${userId}`,
                method: 'GET',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                },
                success: function(response) {
                    const editFormHtml = `
                        <div class="mb-3">
                            <label for="edit_user_name" class="form-label">Username</label>
                            <input type="text" class="form-control" id="edit_user_name"
                                name="user_name" value="${response.user_name}" required>
                        </div>
                        <div class="mb-3">
                            <label for="edit_user_ip" class="form-label">User IP (optional)</label>
                            <input type="text" class="form-control" id="edit_user_ip"
                                name="user_ip" value="${response.user_ip}">
                        </div>
                        <div class="mb-3">
                            <label for="edit_password" class="form-label">New Password (leave blank to keep current)</label>
                            <input type="password" class="form-control" id="edit_password" name="password">
                        </div>
                        ${response.is_admin ? `
                        <div class="mb-3">
                            <label for="edit_role" class="form-label">Role</label>
                            <select class="form-select" id="edit_role" name="role" required>
                                <option value="user" ${response.role === 'user' ? 'selected' : ''}>User</option>
                                <option value="admin" ${response.role === 'admin' ? 'selected' : ''}>Admin</option>
                            </select>
                        </div>
                        ` : ''}
                    `;
                    
                    $('#editUserBody').html(editFormHtml);
                },
                error: function(xhr) {
                    let errorMsg = 'Failed to load user details';
                    if (xhr.responseJSON && xhr.responseJSON.error) {
                        errorMsg = xhr.responseJSON.error;
                    }
                    $('#editUserBody').html(`
                        <div class="alert alert-danger">
                            <p>${errorMsg}</p>
                            <p class="small">Status: ${xhr.status}</p>
                        </div>
                    `);
                }
            });
        });
 
        // Delete user handler
        $(document).on('click', '.delete-user', function() {
            const userId = $(this).data('user-id');
            const $row = $(this).closest('tr');
            
            if (!confirm(`Are you sure you want to delete this user?`)) return;
            
            $.ajax({
                url: `/users/delete/${userId}`,
                method: 'POST',
                success: function(response) {
                    $row.fadeOut(400, function() { $(this).remove(); });
                    alert(response.message || 'User deleted successfully');
                },
                error: function(xhr) {
                    const errorMsg = xhr.responseJSON?.error || 'Failed to delete user';
                    alert(errorMsg);
                }
            });
        });
 
        // Form submission handlers
        $('#addUserForm').submit(function(e) {
            e.preventDefault();
            
            // Get form data
            const formData = {
                user_name: $('#user_name').val(),
                user_ip: $('#user_ip').val(),
                password: $('#password').val(),
                role: $('#role').val()
            };
 
            $.ajax({
                url: $(this).attr('action'),
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify(formData),
                success: function(response) {
                    // Add the new user to the table without page reload
                    const table = $('#usersTable').DataTable();
                    table.row.add([
                        response.user.id,
                        response.user.user_name,
                        response.user.user_ip || '-',
                        `<span class="badge role-badge badge-${response.user.role === 'admin' ? 'admin' : 'user'}">
                            ${response.user.role}
                        </span>`,
                        `<button class="btn btn-sm btn-outline-secondary edit-user"
                                data-user-id="${response.user.id}">
                            Edit
                        </button>
                        <button class="btn btn-sm btn-outline-danger delete-user"
                                data-user-id="${response.user.id}">
                            Delete
                        </button>`
                    ]).draw(false);
                    
                    // Show success message
                    alert(response.message);
                    
                    // Reset form and close modal
                    $('#addUserForm')[0].reset();
                    $('#addUserModal').modal('hide');
 
                    setTimeout(() => {
                        window.location.href = window.location.href;
                    }, 500);
                },
                error: function(xhr) {
                    let errorMsg = 'Failed to add user';
                    if (xhr.responseJSON && xhr.responseJSON.error) {
                        errorMsg = xhr.responseJSON.error;
                    }
                    alert(errorMsg);
                }
            });
        });
 
        $('#editUserForm').submit(function(e) {
            e.preventDefault();
            
            // Get form data
            const formData = {
                user_name: $('#edit_user_name').val(),
                user_ip: $('#edit_user_ip').val(),
                password: $('#edit_password').val(),
                role: $('#edit_role').val()
            };
 
            $.ajax({
                url: $(this).attr('action'),
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify(formData),
                success: function(response) {
                    // Find and update the row in the table
                    const table = $('#usersTable').DataTable();
                    const row = table.row(`tr:has(button[data-user-id="${response.user.id}"])`);
                    
                    if (row.length) {
                        row.data([
                            response.user.id,
                            response.user.user_name,
                            response.user.user_ip || '-',
                            `<span class="badge role-badge badge-${response.user.role === 'admin' ? 'admin' : 'user'}">
                                ${response.user.role}
                            </span>`,
                            `<button class="btn btn-sm btn-outline-secondary edit-user"
                                    data-user-id="${response.user.id}">
                                Edit
                            </button>
                            <button class="btn btn-sm btn-outline-danger delete-user"
                                    data-user-id="${response.user.id}">
                                Delete
                            </button>`
                        ]).draw(false);
                    }
                    
                    alert(response.message);
                    $('#editUserModal').modal('hide');
                },
                error: function(xhr) {
                    let errorMsg = 'Failed to update user';
                    if (xhr.responseJSON && xhr.responseJSON.error) {
                        errorMsg = xhr.responseJSON.error;
                    }
                    alert(errorMsg);
                }
            });
        });
    });
