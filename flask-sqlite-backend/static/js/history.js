
    $(document).ready(function() {
        // Initialize DataTable
        const table = $('#historyTable').DataTable({
            order: [[2, 'desc']],
            pageLength: 25,
            responsive: true
        });

        // Filter handlers
        $('#deviceFilter, #userFilter, #statusFilter').on('change', function() {
            table.column($(this).parent().index()).search(this.value).draw();
        });

        // Date range filtering
        $.fn.dataTable.ext.search.push(
            function(settings, data, dataIndex) {
                const dateFrom = $('#dateFrom').val();
                const dateTo = $('#dateTo').val();
                const rowDate = new Date(data[2]).setHours(0,0,0,0);
                
                if (!dateFrom && !dateTo) return true;
                if (dateFrom && !dateTo) return rowDate >= new Date(dateFrom).setHours(0,0,0,0);
                if (!dateFrom && dateTo) return rowDate <= new Date(dateTo).setHours(0,0,0,0);
                if (dateFrom && dateTo) return rowDate >= new Date(dateFrom).setHours(0,0,0,0) && 
                                           rowDate <= new Date(dateTo).setHours(0,0,0,0);
                return true;
            }
        );

        $('#dateFrom, #dateTo').on('change', function() {
            table.draw();
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

        $('.view-details').click(function() {
            const recordId = $(this).data('record-id');
            const modal = $('#detailsModal');
            
            // Show loading state
            $('#recordDetails').html(`
                <div class="text-center py-4">
                    <div class="spinner-border text-primary" role="status">
                        <span class="sr-only">Loading...</span>
                    </div>
                    <p class="mt-2">Loading record details...</p>
                </div>
            `);
            
            modal.modal('show');

            $.ajax({
                url: `/history/get-usage-record/${recordId}`,
                method: 'GET',
                success: function(response) {
                    if (response.error) {
                        $('#recordDetails').html(`
                            <div class="alert alert-danger">
                                <h5>Error</h5>
                                <p>${response.error}</p>
                            </div>
                        `);
                        return;
                    }

                    const formatDate = (dateStr) => dateStr ? new Date(dateStr).toLocaleString() : 'N/A';
                    const formatDuration = (seconds) => {
                        if (!seconds) return 'N/A';
                        const hours = Math.floor(seconds / 3600);
                        const minutes = Math.floor((seconds % 3600) / 60);
                        return `${hours}h ${minutes}m`;
                    };
                    
                    const getStatusBadge = (status) => {
                        const statusClass = {
                            'active': 'bg-primary',
                            'completed': 'bg-success',
                            'terminated': 'bg-danger',
                            'reserved': 'bg-info'
                        }[status.toLowerCase()] || 'bg-secondary';
                        return `<span class="badge ${statusClass}">${status}</span>`;
                    };

                    const detailsHtml = `
                        <div class="row mb-4">
                            <div class="col-md-6">
                                <h5 class="border-bottom pb-2">Device Information</h5>
                                <p><strong>Device ID:</strong> ${response.device_id}</p>
                            </div>
                            <div class="col-md-6">
                                <h5 class="border-bottom pb-2">User Information</h5>
                                <p><strong>User ID:</strong> ${response.user_info.user_id}</p>
                                <p><strong>Username:</strong> ${response.user_info.user_name}</p>
                                <p><strong>User IP:</strong> ${response.user_info.user_ip || 'N/A'}</p>
                            </div>
                        </div>
                        
                        <div class="row mb-4">
                            <div class="col-md-6">
                                <h5 class="border-bottom pb-2">Timing Information</h5>
                                <p><strong>Start Time:</strong> ${formatDate(response.timing.start_time)}</p>
                                <p><strong>End Time:</strong> ${formatDate(response.timing.end_time)}</p>
                                <p><strong>Duration:</strong> ${formatDuration(response.timing.duration)}</p>
                            </div>
                            <div class="col-md-6">
                                <h5 class="border-bottom pb-2">Network Information</h5>
                                <p><strong>IP Address:</strong> ${response.network_info.ip_address || 'N/A'}</p>
                                <p><strong>IP Type:</strong> ${response.network_info.ip_type || 'N/A'}</p>
                                <p><strong>Status:</strong> ${getStatusBadge(response.status_info.status)}</p>
                            </div>
                        </div>
                        
                        <div class="row">
                            <div class="col-12">
                                <h5 class="border-bottom pb-2">Reservation Details</h5>
                                <p><strong>Reservation ID:</strong> ${response.reservation_info.reservation_id || 'N/A'}</p>
                                <p><strong>Reservation IP Type:</strong> ${response.reservation_info.ip_type || 'N/A'}</p>
                            </div>
                        </div>
                        
                        ${response.status_info.termination_reason ? `
                        <div class="row mt-3">
                            <div class="col-12">
                                <div class="alert alert-warning">
                                    <strong>Termination Reason:</strong> ${response.status_info.termination_reason}
                                </div>
                            </div>
                        </div>` : ''}
                    `;
                    
                    $('#recordDetails').html(detailsHtml);
                },
                error: function(xhr) {
                    let errorMsg = 'Failed to load details';
                    if (xhr.responseJSON && xhr.responseJSON.error) {
                        errorMsg = xhr.responseJSON.error;
                    }
                    $('#recordDetails').html(`
                        <div class="alert alert-danger">
                            <h5>Error</h5>
                            <p>${errorMsg}</p>
                            <p class="small">Status: ${xhr.status}</p>
                        </div>
                    `);
                }
            });
        });

        // Delete record handler
        $(document).on('click', '.delete-record', function() {
            const recordId = $(this).data('record-id');
            const $row = $(this).closest('tr');
            
            if (!confirm('Are you sure you want to delete this record?')) return;
            
            $.ajax({
                url: `/history/delete-usage-record/${recordId}`,
                method: 'DELETE',
                success: function(response) {
                    $row.fadeOut(400, function() { $(this).remove(); });
                    alert(response.message || 'Record deleted successfully');
                },
                error: function(xhr) {
                    const errorMsg = xhr.responseJSON?.error || 'Failed to delete record';
                    alert(errorMsg);
                }
            });
        });

        // Clear history handler
        $('#clearHistoryBtn').click(function() {
            if (!confirm('Delete all records older than 6 months?')) return;
            
            $.ajax({
                url: '/history/clear-old',
                method: 'POST',
                success: function(response) {
                    alert(response.message || 'Old records cleared');
                    location.reload();
                },
                error: function(xhr) {
                    const errorMsg = xhr.responseJSON?.error || 'Failed to clear records';
                    alert(errorMsg);
                }
            });
        });
    });
