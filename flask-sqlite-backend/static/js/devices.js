   $(document).ready(function() {
        // Initialize DataTable
        const table = $('#devicesTable').DataTable({
            order: [[0, 'asc']],
            pageLength: 25,
            responsive: true
        });
 
        // Filter handlers
        $('#deviceIdFilter').on('keyup', function() {
            table.column(0).search(this.value).draw();
        });
 
        $('#ipTypeFilter').on('change', function() {
            if (!this.value) {
                table.columns().search('').draw();
                $('#deviceIdFilter').trigger('keyup');
                return;
            }
            
            const ipTypeMap = {
                'PC': 1,
                'Rutomatrix': 2,
                'Pulse1': 3,
                'Pulse2': 4,
                'Pulse3': 5,
                'CT1': 6,
                'CT2': 7,
                'CT3': 8
            };
            
            table.column(ipTypeMap[this.value]).search($('#ipValueFilter').val()).draw();
        });
 
        $('#ipValueFilter').on('keyup', function() {
            if ($('#ipTypeFilter').val()) {
                $('#ipTypeFilter').trigger('change');
            } else {
                table.columns([1,2,3,4,5,6,7,8]).search(this.value).draw();
            }
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
 
        // View IPs handler
        $('.view-ip').click(function() {
            const deviceId = $(this).data('device-id');
            const modal = $('#ipAccessModal');
            
            $('#modalDeviceId').text(deviceId);
            $('#ipAccessBody').html(`
                <div class="text-center py-4">
                    <div class="spinner-border text-primary" role="status">
                        <span class="sr-only">Loading...</span>
                    </div>
                    <p class="mt-2">Loading IP addresses...</p>
                </div>
            `);
            
            modal.modal('show');
 
            $.ajax({
                url: `/api/devices/${deviceId}`,
                method: 'GET',
                success: function(response) {
                    if (response.error) {
                        $('#ipAccessBody').html(`
                            <div class="alert alert-danger">
                                <p>${response.error}</p>
                            </div>
                        `);
                        return;
                    }
 
                    const ipTypes = [
                        { name: 'PC IP', field: 'PC_IP' },
                        { name: 'Rutomatrix IP', field: 'Rutomatrix_ip' },
                        { name: 'Pulse1 IP', field: 'Pulse1_Ip' },
                        { name: 'Pulse2 IP', field: 'Pulse2_ip' },
                        { name: 'Pulse3 IP', field: 'Pulse3_ip' },
                        { name: 'CT1 IP', field: 'CT1_ip' },
                        { name: 'CT2 IP', field: 'CT2_ip' },
                        { name: 'CT3 IP', field: 'CT3_ip' }
                    ];
 
                    let ipHtml = '<div class="list-group">';
                    
                    ipTypes.forEach(ipType => {
                        const ipValue = response[ipType.field] || 'Not set';
                        ipHtml += `
                            <div class="list-group-item">
                                <div class="d-flex justify-content-between align-items-center">
                                    <strong>${ipType.name}</strong>
                                    <span class="ip-display">${ipValue}</span>
                                </div>
                            </div>
                        `;
                    });
                    
                    ipHtml += '</div>';
                    
                    $('#ipAccessBody').html(ipHtml);
                },
                error: function(xhr) {
                    let errorMsg = 'Failed to load IP addresses';
                    if (xhr.responseJSON && xhr.responseJSON.error) {
                        errorMsg = xhr.responseJSON.error;
                    }
                    $('#ipAccessBody').html(`
                        <div class="alert alert-danger">
                            <p>${errorMsg}</p>
                            <p class="small">Status: ${xhr.status}</p>
                        </div>
                    `);
                }
            });
        });
 
        // Edit device handler
        $('.edit-device').click(function() {
            const deviceId = $(this).data('device-id');
            const modal = $('#editDeviceModal');
            
            $('#editDeviceBody').html(`
                <div class="text-center py-4">
                    <div class="spinner-border text-primary" role="status">
                        <span class="sr-only">Loading...</span>
                    </div>
                    <p class="mt-2">Loading device details...</p>
                </div>
            `);
            
            modal.modal('show');
            $('#editDeviceForm').attr('action', `/edit/${deviceId}`);
 
            $.ajax({
                url: `/edit/${deviceId}`,
                method: 'GET',
                success: function(response) {
                    if (response.error) {
                        $('#editDeviceBody').html(`
                            <div class="alert alert-danger">
                                <p>${response.error}</p>
                            </div>
                        `);
                        return;
                    }
 
                    const editFormHtml = `
                        <div class="row">
                            <div class="col-md-12 mb-3">
                                <label for="edit_device_id" class="form-label">Device ID</label>
                                <input type="text" class="form-control" id="edit_device_id"
                                    name="device_id" value="${response.device_id}" readonly>
                            </div>
                        </div>
                        <div class="row">
                            <div class="col-md-6 mb-3">
                                <label for="edit_PC_IP" class="form-label">PC IP Address</label>
                                <input type="text" class="form-control" id="edit_PC_IP"
                                    name="PC_IP" value="${response.PC_IP || ''}">
                            </div>
                            <div class="col-md-6 mb-3">
                                <label for="edit_Rutomatrix_ip" class="form-label">Rutomatrix IP Address</label>
                                <input type="text" class="form-control" id="edit_Rutomatrix_ip"
                                    name="Rutomatrix_ip" value="${response.Rutomatrix_ip || ''}">
                            </div>
                        </div>
                        <div class="row">
                            <div class="col-md-4 mb-3">
                                <label for="edit_Pulse1_Ip" class="form-label">Pulse1 IP Address</label>
                                <input type="text" class="form-control" id="edit_Pulse1_Ip"
                                    name="Pulse1_Ip" value="${response.Pulse1_Ip || ''}">
                            </div>
                            <div class="col-md-4 mb-3">
                                <label for="edit_Pulse2_ip" class="form-label">Pulse2 IP Address</label>
                                <input type="text" class="form-control" id="edit_Pulse2_ip"
                                    name="Pulse2_ip" value="${response.Pulse2_ip || ''}">
                            </div>
                            <div class="col-md-4 mb-3">
                                <label for="edit_Pulse3_ip" class="form-label">Pulse3 IP Address</label>
                                <input type="text" class="form-control" id="edit_Pulse3_ip"
                                    name="Pulse3_ip" value="${response.Pulse3_ip || ''}">
                            </div>
                        </div>
                        <div class="row">
                            <div class="col-md-4 mb-3">
                                <label for="edit_CT1_ip" class="form-label">CT1 IP Address</label>
                                <input type="text" class="form-control" id="edit_CT1_ip"
                                    name="CT1_ip" value="${response.CT1_ip || ''}">
                            </div>
                            <div class="col-md-4 mb-3">
                                <label for="edit_CT2_ip" class="form-label">CT2 IP Address</label>
                                <input type="text" class="form-control" id="edit_CT2_ip"
                                    name="CT2_ip" value="${response.CT2_ip || ''}">
                            </div>
                            <div class="col-md-4 mb-3">
                                <label for="edit_CT3_ip" class="form-label">CT3 IP Address</label>
                                <input type="text" class="form-control" id="edit_CT3_ip"
                                    name="CT3_ip" value="${response.CT3_ip || ''}">
                            </div>
                        </div>
                    `;
                    
                    $('#editDeviceBody').html(editFormHtml);
                },
                error: function(xhr) {
                    let errorMsg = 'Failed to load device details';
                    if (xhr.responseJSON && xhr.responseJSON.error) {
                        errorMsg = xhr.responseJSON.error;
                    }
                    $('#editDeviceBody').html(`
                        <div class="alert alert-danger">
                            <p>${errorMsg}</p>
                            <p class="small">Status: ${xhr.status}</p>
                        </div>
                    `);
                }
            });
        });
 
        // Delete device handler
        $(document).on('click', '.delete-device', function() {
            const deviceId = $(this).data('device-id');
            const $row = $(this).closest('tr');
            
            if (!confirm(`Are you sure you want to delete device ${deviceId}?`)) return;
            
            $.ajax({
                url: `/delete/${deviceId}`,
                method: 'POST',
                success: function(response) {
                    $row.fadeOut(400, function() { $(this).remove(); });
                    alert(response.message || 'Device deleted successfully');
                },
                error: function(xhr) {
                    const errorMsg = xhr.responseJSON?.error || 'Failed to delete device';
                    alert(errorMsg);
                }
            });
        });
 
        // Form submission handlers
        $('#addDeviceForm').submit(function(e) {
            e.preventDefault();
            const formData = $(this).serialize();
            
            $.ajax({
                url: $(this).attr('action'),
                method: 'POST',
                data: formData,
                success: function(response) {
                    alert(response.message || 'Device added successfully');
                    $('#addDeviceModal').modal('hide');
                    location.reload();
                },
                error: function(xhr) {
                    let errorMsg = 'Failed to add device';
                    if (xhr.responseJSON && xhr.responseJSON.error) {
                        errorMsg = xhr.responseJSON.error;
                    }
                    alert(errorMsg);
                }
            });
        });
 
        $('#editDeviceForm').submit(function(e) {
            e.preventDefault();
            const formData = $(this).serialize();
            
            $.ajax({
                url: $(this).attr('action'),
                method: 'POST',
                data: formData,
                success: function(response) {
                    alert(response.message || 'Device updated successfully');
                    $('#editDeviceModal').modal('hide');
                    location.reload();
                },
                error: function(xhr) {
                    let errorMsg = 'Failed to update device';
                    if (xhr.responseJSON && xhr.responseJSON.error) {
                        errorMsg = xhr.responseJSON.error;
                    }
                    alert(errorMsg);
                }
            });
        });
    });
