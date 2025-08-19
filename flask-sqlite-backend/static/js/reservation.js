     document.addEventListener("DOMContentLoaded", function () {
        lucide.createIcons();
        // Global variables
        let selectedDeviceId = null;
        let selectedDrivers = [];
        let bookedDevicesData = [];
        let allDevicesData = [];
        let startTime = "";
        let endTime = "";
        let currentFilter = "";

        // DOM elements
        const bookReservationBtn =
          document.getElementById("bookReservationBtn");
        const deviceSelectionOverlay = document.getElementById(
          "deviceSelectionOverlay"
        );
        const closeOverlayBtns = document.querySelectorAll(".close-overlay");
        const backToDevicesBtn = document.getElementById("backToDevicesBtn");
        const deviceTabs = document.querySelectorAll(".device-tab");
        const availableDevicesTab =
          document.getElementById("available-devices");
        const bookedDevicesTab = document.getElementById("booked-devices");
        const bookedDevicesTable =
          document.getElementById("bookedDevicesTable");
        const confirmDeviceSelectionBtn = document.getElementById(
          "confirmDeviceSelectionBtn"
        );
        const driverSelectionOverlay = document.getElementById(
          "driverSelectionOverlay"
        );
        const driverGrid = document.querySelector(".driver-grid");
        const selectedDeviceNameSpan =
          document.getElementById("selectedDeviceName");
        const selectedDriversCountSpan = document.getElementById(
          "selectedDriversCount"
        );
        const selectedDriversListDiv = document.getElementById(
          "selectedDriversList"
        );
        const confirmDriverSelectionBtn = document.getElementById(
          "confirmDriverSelectionBtn"
        );
        const cancelToast = document.getElementById("cancelToast");
        const toastMessage = document.getElementById("toastMessage");

        // Initialize Flatpickr for datetime inputs
        const startTimePicker = flatpickr("#start_time", {
          enableTime: true,
          dateFormat: "Y-m-d H:i",
          minDate: "today",
          time_24hr: true,
          minuteIncrement: 1,
          defaultHour: new Date().getHours(),
          defaultMinute: 0,
          utc: true,
          onReady: function (selectedDates, dateStr, instance) {
            instance.element.placeholder = "Select start time (hh:mm)";
          },
        });

        const endTimePicker = flatpickr("#end_time", {
          enableTime: true,
          dateFormat: "Y-m-d H:i",
          minDate: "today",
          time_24hr: true,
          minuteIncrement: 1,
          defaultHour: new Date().getHours() + 1,
          defaultMinute: 0,
          utc: true,
          onReady: function (selectedDates, dateStr, instance) {
            instance.element.placeholder = "Select end time (hh:mm)";
          },
        });

        // Quick select buttons for time
        document.querySelectorAll(".quick-select-btn").forEach((button) => {
          button.addEventListener("click", function () {
            const minutes = parseInt(this.getAttribute("data-minutes"));
            const isStartTime = this.closest(".col-md-6")
              .querySelector("label")
              .textContent.includes("Start");
            const inputId = isStartTime ? "start_time" : "end_time";
            const input = document.getElementById(inputId);
            const fp = input._flatpickr;

            if (isStartTime) {
              const newDate = new Date(Date.now() + minutes * 60 * 1000);
              fp.setDate(newDate);
              startTime = fp.input.value;
            } else {
              let baseDate;
              if (startTime) {
                baseDate = new Date(startTime);
              } else {
                baseDate = new Date();
                document
                  .getElementById("start_time")
                  ._flatpickr.setDate(baseDate);
                startTime = document.getElementById("start_time").value;
              }
              const newDate = new Date(
                baseDate.getTime() + minutes * 60 * 1000
              );
              fp.setDate(newDate);
            }
            endTime =
              document.getElementById("end_time")._flatpickr.input.value;
          });
        });

        bookReservationBtn.addEventListener("click", async function () {
          startTime = document.getElementById("start_time").value;
          endTime = document.getElementById("end_time").value;

          if (!startTime || !endTime) {
            showToast("Please select both start and end times","warning");
            return;
          }

          const now = new Date();
          const selectedStart = new Date(startTime);

          if (selectedStart < now) {
            showToast(
              "Cannot book in past time. Please select future time slots","warning"
            );
            return;
          }

          if (new Date(endTime) <= selectedStart) {
            showToast("End time must be after start time","warning");
            return;
          }

          deviceSelectionOverlay.style.display = "block";
          document.body.style.overflow = "hidden";

          try {
            await loadBookedDevices();
            loadDevices();
          } catch (error) {
            console.error("Error loading devices:", error);
            showToast("Failed to load device data", "error");
          }
        });

        // Close overlay buttons
        closeOverlayBtns.forEach((btn) => {
          btn.addEventListener("click", function () {
            deviceSelectionOverlay.style.display = "none";
            driverSelectionOverlay.style.display = "none";
            document.body.style.overflow = "auto";
          });
        });

        // Device tabs switching
        deviceTabs.forEach((tab) => {
          tab.addEventListener("click", function () {
            const tabName = this.getAttribute("data-tab");

            deviceTabs.forEach((t) => t.classList.remove("active"));
            this.classList.add("active");

            if (tabName === "available") {
              availableDevicesTab.style.display = "block";
              bookedDevicesTab.style.display = "none";
            } else {
              availableDevicesTab.style.display = "none";
              bookedDevicesTab.style.display = "block";
            }
          });
        });

        // Back to devices button in driver selection
        backToDevicesBtn.addEventListener("click", function () {
          driverSelectionOverlay.style.display = "none";
          deviceSelectionOverlay.style.display = "block";
        });

        // Load all devices
        function loadDevices() {
          const serverRackContainer = document.querySelector(
            ".server-rack-container"
          );
          serverRackContainer.innerHTML =
            '<div class="loading-message"><i class="fas fa-spinner fa-spin"></i> Loading devices...</div>';

          fetch("/api/devices")
            .then((response) => {
              if (!response.ok) throw new Error("Network response was not ok");
              return response.json();
            })
            .then((data) => {
              allDevicesData = Array.isArray(data) ? data : data.devices || [];
              filterDevices();
            })
            .catch((error) => {
              console.error("Error loading devices:", error);
              serverRackContainer.innerHTML = `
                        <div class="error-message">
                            Error loading devices: ${error.message}
                            <button class="btn btn-sm btn-primary mt-2" onclick="loadDevices()">
                                <i class="fas fa-sync-alt me-1"></i> Retry
                            </div>
                        </div>
                    `;
            });
        }

        function groupDevices(devices) {
          const groups = {};
          const now = new Date();

          devices.forEach((device) => {
            const deviceBookings = bookedDevicesData.filter(
              (booking) => booking.device_id === device.device_id
            );

            const totalDrivers = Object.keys(device).filter((key) =>
              key.toLowerCase().includes("_ip")
            ).length;

            const bookedDriversCount = deviceBookings.filter((booking) =>
              isTimeOverlap(
                startTime,
                endTime,
                booking.start_time,
                booking.end_time
              )
            ).length;

            device.status =
              bookedDriversCount >= totalDrivers ? "fully-booked" : "available";
            device.bookings = deviceBookings;
            device.totalDrivers = totalDrivers;
            device.bookedCount = bookedDriversCount;

            const groupKey = device.type || "Default";
            if (!groups[groupKey]) groups[groupKey] = [];
            groups[groupKey].push(device);
          });

          return groups;
        }

        function isTimeOverlap(start1, end1, start2, end2) {
          return (
            new Date(start1) < new Date(end2) &&
            new Date(end1) > new Date(start2)
          );
        }

        document
          .getElementById("deviceFilter")
          .addEventListener("input", function (e) {
            currentFilter = e.target.value.toLowerCase();
            filterDevices();
          });

        document
          .getElementById("clearFilter")
          .addEventListener("click", function () {
            document.getElementById("deviceFilter").value = "";
            currentFilter = "";
            filterDevices();
          });

        function filterDevices() {
          if (!allDevicesData || allDevicesData.length === 0) return;

          let filteredDevices = allDevicesData.filter((device) => {
            return device.device_id.toLowerCase().includes(currentFilter);
          });

          renderDevices(filteredDevices);
        }

        function loadBookedDevices() {
          return new Promise((resolve, reject) => {
            const bookedDevicesCards =
              document.getElementById("bookedDevicesCards");
            bookedDevicesCards.innerHTML =
              '<div class="loading-message"><i class="fas fa-spinner fa-spin"></i> Loading booked devices...</div>';

            fetch("/api/booked-devices")
              .then((response) => {
                if (!response.ok)
                  throw new Error("Network response was not ok");
                return response.json();
              })
              .then((data) => {
                if (!data.success) {
                  throw new Error("API request failed");
                }

                bookedDevicesData = [];

                data.booked_devices.forEach((reservation) => {
                  if (reservation.ip_type.includes(",")) {
                    const ipTypes = reservation.ip_type.split(",");
                    ipTypes.forEach((ipType) => {
                      bookedDevicesData.push({
                        ...reservation,
                        ip_type: ipType.trim(),
                      });
                    });
                  } else {
                    bookedDevicesData.push(reservation);
                  }
                });

                const devicesWithDriverCounts = bookedDevicesData.reduce(
                  (acc, booking) => {
                    if (!acc[booking.device_id]) {
                      acc[booking.device_id] = {
                        device_id: booking.device_id,
                        device_name: booking.device_name,
                        driver_count: 0,
                        unique_drivers: new Set(),
                        bookings: [],
                      };
                    }

                    if (
                      !acc[booking.device_id].unique_drivers.has(
                        booking.ip_type
                      )
                    ) {
                      acc[booking.device_id].unique_drivers.add(
                        booking.ip_type
                      );
                      acc[booking.device_id].driver_count++;
                    }

                    acc[booking.device_id].bookings.push(booking);
                    return acc;
                  },
                  {}
                );

                const groupedBookings = Object.values(devicesWithDriverCounts);
                renderBookedDevices(groupedBookings);
                resolve();
              })
              .catch((error) => {
                console.error("Error loading booked devices:", error);
                bookedDevicesCards.innerHTML = `
                            <div class="text-center text-danger">
                                <i class="fas fa-exclamation-triangle"></i> ${error.message}
                                <button class="btn btn-sm btn-outline-secondary ms-2" onclick="loadBookedDevices()">
                                    <i class="fas fa-sync-alt"></i> Retry
                                </button>
                            </div>
                        `;
                reject(error);
              });
          });
        }

        function renderBookedDevices(groupedBookings) {
          const bookedDevicesCards =
            document.getElementById("bookedDevicesCards");
          bookedDevicesCards.innerHTML = "";

          if (bookedDevicesData.length === 0) {
            bookedDevicesCards.innerHTML = `
                    <div class="text-center py-4 text-muted">
                        <i class="far fa-calendar-times fa-2x mb-2"></i><br>
                        No booked devices found
                    </div>
                `;
            return;
          }

          const deviceReservationMap = {};

          bookedDevicesData.forEach((booking) => {
            if (!deviceReservationMap[booking.device_id]) {
              deviceReservationMap[booking.device_id] = {};
            }

            if (
              !deviceReservationMap[booking.device_id][booking.reservation_id]
            ) {
              deviceReservationMap[booking.device_id][booking.reservation_id] =
                {
                  ...booking,
                  drivers: [],
                };
            }

            deviceReservationMap[booking.device_id][
              booking.reservation_id
            ].drivers.push({
              ip_type: booking.ip_type,
              ip_address:
                booking.device_details[booking.ip_type.toLowerCase() + "_ip"] ||
                "N/A",
            });
          });

          for (const deviceId in deviceReservationMap) {
            for (const reservationId in deviceReservationMap[deviceId]) {
              const reservation = deviceReservationMap[deviceId][reservationId];
              const now = new Date();
              const startTime = new Date(reservation.start_time);
              const endTime = new Date(reservation.end_time);

              const status =
                endTime < now
                  ? "Expired"
                  : startTime <= now && now <= endTime
                  ? "Active"
                  : "Upcoming";

              const statusClass =
                endTime < now
                  ? "bg-secondary"
                  : startTime <= now && now <= endTime
                  ? "bg-success"
                  : "bg-primary";

              const deviceType = reservation.device_details?.type || "other";
              const iconClass = getDeviceIconClass(deviceType);

              const card = document.createElement("div");
              card.className = "booked-device-card";
              card.innerHTML = `
                    <div class="booked-device-card-header">
                        <div class="d-flex align-items-center">
                            <i class="${iconClass} me-2"></i>
                            <h5 class="booked-device-card-title mb-0">${
                              reservation.device_name || reservation.device_id
                            }</h5>
                        </div>
                        <span class="badge ${statusClass} booked-device-card-status">${status}</span>
                    </div>
                    <div class="booked-device-card-body">
                        <div class="booked-device-card-row">
                            <span class="booked-device-card-label">Device ID:</span>
                            <span class="booked-device-card-value">${
                              reservation.device_id
                            }</span>
                        </div>
                        <div class="booked-device-card-row">
                            <span class="booked-device-card-label">User:</span>
                            <span class="booked-device-card-value">${
                              reservation.user_name || "N/A"
                            }</span>
                        </div>
                        <div class="booked-device-card-row">
                            <span class="booked-device-card-label">Start:</span>
                            <span class="booked-device-card-value">${formatDateTime(
                              reservation.start_time
                            )}</span>
                        </div>
                        <div class="booked-device-card-row">
                            <span class="booked-device-card-label">End:</span>
                            <span class="booked-device-card-value">${formatDateTime(
                              reservation.end_time
                            )}</span>
                        </div>
                        <div class="booked-device-card-row">
                            <span class="booked-device-card-label">Drivers:</span>
                            <span class="booked-device-card-value">
                                ${reservation.drivers
                                  .map(
                                    (driver) =>
                                      `<span class="badge bg-info me-1">${driver.ip_type}</span>`
                                  )
                                  .join("")}
                            </span>
                        </div>
                    </div>
                    <div class="booked-device-card-footer">
                    </div>
                `;

              bookedDevicesCards.appendChild(card);
            }
          }

          addBookingButtonEventListeners();
        }

        function getDeviceIconClass(deviceType) {
          const type = deviceType.toLowerCase();
          if (type.includes("rutomatrix"))
            return "fas fa-microchip rutomatrix-icon";
          if (type.includes("pulse")) return "pulse-icon";
          if (type.includes("ct")) return "fas fa-camera ct-icon";
          if (type.includes("pc")) return "fas fa-desktop pc-icon";
          return "fas fa-server other-icon";
        }

        async function cancelReservation(reservationId, isAdmin = false) {
          const confirmMessage = isAdmin
            ? "Are you sure you want to cancel this reservation as admin?"
            : "Are you sure you want to cancel your reservation?";

          if (!confirm(confirmMessage)) return;

          try {
            const response = await fetch(
              `/reservation/cancel/${reservationId}`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "X-Requested-With": "XMLHttpRequest",
                  "X-CSRFToken": document.querySelector(
                    'meta[name="csrf-token"]'
                  ).content,
                },
              }
            );

            const data = await response.json();

            if (!response.ok) {
              throw new Error(data.message || "Failed to cancel reservation");
            }

            alert(data.message);
            window.location.reload();
          } catch (error) {
            console.error("Cancellation error:", error);
            alert(error.message);
          }
        }

        document.addEventListener("click", function (e) {
          if (e.target.closest(".cancel-btn")) {
            const button = e.target.closest(".cancel-btn");
            const reservationId = button.dataset.reservationId;
            cancelReservation(reservationId);
          }
        });

        function getCSRFToken() {
          return (
            document.querySelector("[name=csrfmiddlewaretoken]")?.value || ""
          );
        }

        function formatDateTime(dateString) {
          const date = new Date(dateString);
          return date.toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });
        }

        function addBookingButtonEventListeners() {
          document.querySelectorAll(".launch-btn").forEach((btn) => {
            btn.addEventListener("click", function () {
              const deviceId = this.getAttribute("data-device-id");
              const ipType = this.getAttribute("data-ip-type");
              const reservationId = this.getAttribute("data-reservation-id");
              launchDashboard(deviceId, ipType, reservationId);
            });
          });
        }

        function selectDevice(device) {
          selectedDeviceId = device.device_id;
          selectedDeviceNameSpan.textContent =
            device.name || `Device ${device.device_id}`;

          deviceSelectionOverlay.style.display = "none";
          driverSelectionOverlay.style.display = "block";

          loadDrivers(device.device_id);
        }

        function loadDrivers(deviceId) {
          driverGrid.innerHTML =
            '<div class="loading-message"><i class="fas fa-spinner fa-spin"></i> Loading drivers...</div>';
          selectedDrivers = [];
          updateSelectedDriversUI();

          fetch(`/api/devices/${deviceId}`)
            .then((response) => response.json())
            .then((data) => {
              const drivers = [];

              for (const key in data) {
                if (key.toLowerCase().includes("ip")) {
                  drivers.push({
                    id: key,
                    name: key.replace(/_/g, " ").replace(/ip/i, "").trim(),
                    version: "",
                    description: data[key],
                    ip_address: data[key],
                  });
                }
              }

              renderDrivers(drivers);
            })
            .catch((error) => {
              console.error("Error loading drivers:", error);
              driverGrid.innerHTML =
                '<div class="error-message">Error loading drivers. Please try again.</div>';
            });
        }

        function renderDrivers(drivers) {
          driverGrid.innerHTML = "";

          if (drivers.length === 0) {
            driverGrid.innerHTML = `
                    <div class="text-center py-4 text-muted">
                        <i class="fas fa-exclamation-circle fa-2x mb-3"></i>
                        <p>No drivers found for this device</p>
                    </div>
                `;
            return;
          }

          const driversContainer = document.createElement("div");
          driversContainer.className = "driver-section";
          driversContainer.innerHTML = "<h5>Drivers</h5>";
          const driversList = document.createElement("div");
          driversList.className = "driver-cards-container";
          driversContainer.appendChild(driversList);

          const deviceBookings = bookedDevicesData.filter(
            (booking) => booking.device_id === selectedDeviceId
          );

          drivers.forEach((driver) => {
            let iconClass = "fas fa-microchip";
            if (driver.name.toLowerCase().includes("pulse")) {
              iconClass = "pulse-icon";
            } else if (driver.name.toLowerCase().includes("ct")) {
              iconClass = "fas fa-camera";
            } else if (driver.name.toLowerCase().includes("pc")) {
              iconClass = "fas fa-desktop";
            }

            const driverCard = document.createElement("div");
            driverCard.className = "driver-card";
            driverCard.dataset.driverId = driver.id;

            const driverBookings = deviceBookings.filter(
              (booking) =>
                booking.ip_type.toLowerCase() === driver.id.toLowerCase() &&
                isTimeOverlap(
                  startTime,
                  endTime,
                  booking.start_time,
                  booking.end_time
                )
            );

            const isBooked = driverBookings.length > 0;

            if (isBooked) {
              driverCard.classList.add("booked");
              driverCard.innerHTML = `
                        <div class="driver-icon">
                            <i class="${iconClass}"></i>
                        </div>
                        <div class="driver-name"><div>${
                          driver.name
                        }</div><span class="badge bg-danger">Booked</span></div>
                        <div class="driver-ip">${driver.ip_address}</div>
                        <div class="booking-info">
                            ${driverBookings
                              .map(
                                (booking) => `
                                <div class="booking-slot">
                                    <small>${formatTime(
                                      booking.start_time
                                    )} - ${formatTime(booking.end_time)}</small>
                                    <span class="badge bg-secondary">${
                                      booking.user_name || "Unknown"
                                    }</span>
                                </div>
                            `
                              )
                              .join("")}
                        </div>
                    `;
              driverCard.onclick = () => {
                showToast(
                  "This driver is already booked for the selected time",
                  "warning"
                );
              };
            } else {
              driverCard.classList.add("available");
              driverCard.innerHTML = `
                        <div class="driver-icon">
                            <i class="${iconClass}"></i>
                        </div>
                        <div class="driver-name"><div>${driver.name}</div> <span class="badge bg-success">Available</span></div>
                        <div class="driver-ip">${driver.ip_address}</div>
                    `;
              driverCard.addEventListener("click", () => {
                driverCard.classList.toggle("selected");

                if (driverCard.classList.contains("selected")) {
                  selectedDrivers.push(driver);
                } else {
                  selectedDrivers = selectedDrivers.filter(
                    (d) => d.id !== driver.id
                  );
                }

                updateSelectedDriversUI();
              });
            }

            driversList.appendChild(driverCard);
          });

          driverGrid.appendChild(driversContainer);
        }

        function updateSelectedDriversUI() {
          selectedDriversCountSpan.textContent = selectedDrivers.length;

          if (selectedDrivers.length === 0) {
            selectedDriversListDiv.innerHTML =
              '<div class="text-muted">No drivers selected</div>';
            confirmDriverSelectionBtn.disabled = true;
          } else {
            selectedDriversListDiv.innerHTML = selectedDrivers
              .map(
                (driver) =>
                  `<div class="selected-driver">
                        <span>${driver.name}</span>
                        <span class="driver-ip">${driver.ip_address}</span>
                    </div>`
              )
              .join("");
            confirmDriverSelectionBtn.disabled = false;
          }
        }

        confirmDriverSelectionBtn.addEventListener("click", async function () {
          if (selectedDrivers.length === 0) {
            showToast("Please select at least one driver", "warning");
            return;
          }

          const csrfToken = document.querySelector(
            'input[name="csrf_token"]'
          ).value;
          const loadingToast = showToast(
            "Processing your reservation...",
            "info",
            true
          );

          try {
            const response = await fetch("/api/reservations", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-CSRFToken": csrfToken,
              },
              body: JSON.stringify({
                device_id: selectedDeviceId,
                ip_type: selectedDrivers.map((d) => d.id).join(","),
                start_time: startTime,
                end_time: endTime,
                csrf_token: csrfToken,
              }),
            });

            const data = await response.json();

            if (!response.ok || data.status !== "success") {
              throw new Error(data.message || "Failed to create reservation");
            }

            showToast("Reservation successful!", "success");

            setTimeout(() => {
              driverSelectionOverlay.style.display = "none";
              document.body.style.overflow = "auto";

              loadBookedDevices().then(() => {
                updateDeviceCardStatus(selectedDeviceId);
                window.location.href = window.location.href;
              });
            }, 500);
          } catch (error) {
            console.error("Booking error:", error);
            showToast(error.message, "error");
          } finally {
            if (loadingToast) {
              setTimeout(() => loadingToast.hide(), 2500);
            }
          }
        });

        document.querySelectorAll(".cancel-form").forEach((form) => {
          form.addEventListener("submit", async function (e) {
            e.preventDefault();

            const submitBtn = form.querySelector('button[type="submit"]');
            const originalContent = submitBtn.innerHTML;

            submitBtn.innerHTML =
              '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Cancelling...';
            submitBtn.disabled = true;

            try {
              const response = await fetch(form.action, {
                method: "POST",
                headers: {
                  "X-Requested-With": "XMLHttpRequest",
                  "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams(new FormData(form)),
              });

              const data = await response.json();

              if (response.ok && data.status === "success") {
                const reservationRow = form.closest("tr");
                if (reservationRow) {
                  reservationRow.remove();
                }

                alert("Reservation cancelled successfully!");

                if (typeof updateReservationCount === "function") {
                  updateReservationCount();
                }
              } else {
                alert(data.message || "Failed to cancel reservation");
              }
            } catch (error) {
              console.error("Cancellation error:", error);
              alert("An error occurred while cancelling");
            } finally {
              submitBtn.innerHTML = originalContent;
              submitBtn.disabled = false;
            }
          });
        });

        function updateDeviceCardStatus(deviceId) {
          const deviceCards = document.querySelectorAll(".device-card");
          const device = allDevicesData.find((d) => d.device_id === deviceId);

          if (!device) return;

          const deviceBookings = bookedDevicesData.filter(
            (booking) => booking.device_id === deviceId
          );

          const totalDrivers = Object.keys(device).filter((key) =>
            key.toLowerCase().includes("_ip")
          ).length;

          const bookedDrivers = new Set();
          deviceBookings.forEach((booking) => {
            if (
              isTimeOverlap(
                startTime,
                endTime,
                booking.start_time,
                booking.end_time
              )
            ) {
              bookedDrivers.add(booking.ip_type);
            }
          });
          const bookedDriversCount = bookedDrivers.size;

          const isFullyBooked = bookedDriversCount >= totalDrivers;
          const newStatus = isFullyBooked ? "fully-booked" : "available";

          deviceCards.forEach((card) => {
            if (card.dataset.deviceId === deviceId) {
              card.classList.remove("available", "fully-booked", "disabled");

              if (isFullyBooked) {
                card.classList.add("fully-booked", "disabled");
                card.querySelector(".device-status").innerHTML =
                  '<span class="badge bg-danger">Fully Booked</span>';

                card.onclick = () => {
                  showToast(
                    "All drivers on this device are booked for the selected time",
                    "warning"
                  );
                };
              } else {
                card.classList.add("available");
                card.querySelector(".device-status").innerHTML = `
                            <span class="badge bg-success">Available</span>
                            <small class="text-muted">(${bookedDriversCount}/${totalDrivers} drivers booked)</small>
                        `;

                card.onclick = () => selectDevice(device);
              }

              const deviceIndex = allDevicesData.findIndex(
                (d) => d.device_id === deviceId
              );
              if (deviceIndex !== -1) {
                allDevicesData[deviceIndex].status = newStatus;
                allDevicesData[deviceIndex].bookedCount = bookedDriversCount;
                allDevicesData[deviceIndex].totalDrivers = totalDrivers;
              }
            }
          });
        }

        function renderDevices(devices) {
          const serverRackContainer = document.querySelector(
            ".server-rack-container"
          );
          serverRackContainer.innerHTML = "";

          const grouped = groupDevices(devices);
          const devicesPerPage = 10;

          for (const [group, groupDevices] of Object.entries(grouped)) {
            const groupSection = document.createElement("div");
            groupSection.classList.add("device-group");

            const groupTitle = document.createElement("h5");
            groupTitle.textContent = group;
            groupSection.appendChild(groupTitle);

            const paginationContainer = document.createElement("div");
            paginationContainer.classList.add("pagination-container");

            const deviceGrid = document.createElement("div");
            deviceGrid.classList.add("device-grid");

            showPage(groupDevices, deviceGrid, 1, devicesPerPage);

            if (groupDevices.length > devicesPerPage) {
              const pageCount = Math.ceil(groupDevices.length / devicesPerPage);
              const pagination = createPaginationControls(
                pageCount,
                groupDevices,
                deviceGrid,
                devicesPerPage
              );
              paginationContainer.appendChild(pagination);
            }

            groupSection.appendChild(paginationContainer);
            groupSection.appendChild(deviceGrid);
            serverRackContainer.appendChild(groupSection);
          }
        }

        function showPage(devices, container, pageNumber, perPage) {
          container.innerHTML = "";

          const startIndex = (pageNumber - 1) * perPage;
          const endIndex = Math.min(startIndex + perPage, devices.length);

          for (let i = startIndex; i < endIndex; i++) {
            const deviceCard = createDeviceCard(devices[i]);
            container.appendChild(deviceCard);
          }
        }

        function createPaginationControls(
          pageCount,
          devices,
          deviceGrid,
          perPage
        ) {
          const pagination = document.createElement("ul");
          pagination.classList.add("pagination");

          const prevItem = document.createElement("li");
          prevItem.classList.add("page-item");
          prevItem.innerHTML = '<a class="page-link" href="#">&laquo;</a>';
          prevItem.addEventListener("click", (e) => {
            e.preventDefault();
            const activePage = pagination.querySelector(".page-item.active");
            const currentPage = parseInt(activePage.textContent);
            if (currentPage > 1) {
              updateActivePage(pagination, currentPage - 1);
              showPage(devices, deviceGrid, currentPage - 1, perPage);
            }
          });
          pagination.appendChild(prevItem);

          for (let i = 1; i <= pageCount; i++) {
            const pageItem = document.createElement("li");
            pageItem.classList.add("page-item");
            if (i === 1) pageItem.classList.add("active");
            pageItem.innerHTML = `<a class="page-link" href="#">${i}</a>`;
            pageItem.addEventListener("click", (e) => {
              e.preventDefault();
              updateActivePage(pagination, i);
              showPage(devices, deviceGrid, i, perPage);
            });
            pagination.appendChild(pageItem);
          }

          const nextItem = document.createElement("li");
          nextItem.classList.add("page-item");
          nextItem.innerHTML = '<a class="page-link" href="#">&raquo;</a>';
          nextItem.addEventListener("click", (e) => {
            e.preventDefault();
            const activePage = pagination.querySelector(".page-item.active");
            const currentPage = parseInt(activePage.textContent);
            if (currentPage < pageCount) {
              updateActivePage(pagination, currentPage + 1);
              showPage(devices, deviceGrid, currentPage + 1, perPage);
            }
          });
          pagination.appendChild(nextItem);

          return pagination;
        }

        function updateActivePage(pagination, newActivePage) {
          const pages = pagination.querySelectorAll(".page-item");
          pages.forEach((page) => {
            page.classList.remove("active");
            if (page.textContent === String(newActivePage)) {
              page.classList.add("active");
            }
          });
        }

        function createDeviceCard(device) {
          const deviceCard = document.createElement("div");
          deviceCard.className = "device-card";
          deviceCard.dataset.deviceId = device.device_id;

          if (device.status === "fully-booked") {
            deviceCard.classList.add("fully-booked");
            deviceCard.classList.add("disabled");
          } else {
            deviceCard.classList.add("available");
          }

          const deviceName = device.name || `Device ${device.device_id}`;
          const iconClass = getDeviceIconClass(device.type || "other");

          deviceCard.innerHTML = `
                <div class="device-icon">
                    <i class="${iconClass}"></i>
                </div>
                <div class="device-name">${deviceName}</div>
                <div class="device-status">
                    ${
                      device.status === "available"
                        ? `<span class="badge bg-success">Available</span>
                         <small class="text-muted">(${device.bookedCount}/${device.totalDrivers} drivers booked)</small>`
                        : `<span class="badge bg-danger">Fully Booked</span>`
                    }
                </div>
            `;

          if (device.status === "available") {
            deviceCard.addEventListener("click", () => selectDevice(device));
          } else {
            deviceCard.addEventListener("click", () => {
              showToast(
                "All drivers on this device are booked for the selected time",
                "warning"
              );
            });
          }

          return deviceCard;
        }

        function isTimeOverlap(start1, end1, start2, end2) {
          const startDate1 = new Date(start1);
          const endDate1 = new Date(end1);
          const startDate2 = new Date(start2);
          const endDate2 = new Date(end2);

          return startDate1 < endDate2 && endDate1 > startDate2;
        }

        function formatDateTime(dateTimeStr) {
          const date = new Date(dateTimeStr);
          return date.toLocaleString([], {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });
        }

        function formatTime(dateTimeStr) {
          const date = new Date(dateTimeStr);
          return date.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });
        }

        function showToast(message, type = "success", persistent = false) {
          toastMessage.textContent = message;

          const toastHeader = cancelToast.querySelector(".toast-header");
          toastHeader.className = "toast-header";
          toastHeader.classList.add(
            type === "success"
              ? "bg-success"
              : type === "error"
              ? "bg-danger"
              : type === "warning"
              ? "bg-warning"
              : "bg-info"
          );
          toastHeader.classList.add("text-white");

          const toast = new bootstrap.Toast(cancelToast);

          if (!persistent) {
            setTimeout(() => toast.hide(), 5000);
          }

          toast.show();
          return toast;
        }

        document
          .getElementById("bookedDeviceFilter")
          .addEventListener("input", function () {
            const filterValue = this.value.toLowerCase();
            filterBookedDevicesById(filterValue);
          });

        document
          .getElementById("clearBookedFilter")
          .addEventListener("click", function () {
            document.getElementById("bookedDeviceFilter").value = "";
            filterBookedDevicesById("");
          });

        function filterBookedDevicesById(filterValue) {
          const cards = document.querySelectorAll(
            "#bookedDevicesCards .booked-device-card"
          );
          cards.forEach((card) => {
            const deviceId =
              card
                .querySelector(
                  ".booked-device-card-row .booked-device-card-value"
                )
                ?.textContent?.toLowerCase() || "";
            card.style.display = deviceId.includes(filterValue) ? "" : "none";
          });
        }

        // Auto-refresh functionality
        function setupAutoRefresh() {
          const now = new Date();
          const nowTimestamp = now.getTime() / 1000;
          let refreshTimeouts = [];

          refreshTimeouts.forEach((timeout) => clearTimeout(timeout));
          refreshTimeouts = [];

          document
            .querySelectorAll("tr[data-start-time][data-end-time]")
            .forEach((row) => {
              const startTime = parseFloat(row.getAttribute("data-start-time"));
              const endTime = parseFloat(row.getAttribute("data-end-time"));
              const status = row.getAttribute("data-status");

              let timeUntilRefresh;

              if (status === "upcoming") {
                timeUntilRefresh = startTime - nowTimestamp;
              } else if (status === "active") {
                timeUntilRefresh = endTime - nowTimestamp;
              } else {
                return;
              }

              if (timeUntilRefresh > 0) {
                const timeoutId = setTimeout(() => {
                  window.location.reload();
                }, timeUntilRefresh * 1000);

                refreshTimeouts.push(timeoutId);
              }
            });
        }

        // Initialize auto-refresh
        setupAutoRefresh();

        // Table Sorting Functionality
        document.querySelectorAll(".sortable").forEach((header) => {
          header.addEventListener("click", function () {
            const table = this.closest("table");
            const tbody = table.querySelector("tbody");
            const rows = Array.from(tbody.querySelectorAll("tr"));
            const sortKey = this.getAttribute("data-sort");
            const isAscending = !this.classList.contains("sorted-asc");

            table.querySelectorAll(".sortable").forEach((h) => {
              h.classList.remove("sorted-asc", "sorted-desc");
            });

            this.classList.add(isAscending ? "sorted-asc" : "sorted-desc");

            rows.sort((a, b) => {
              const aValue =
                a.getAttribute(`data-${sortKey}`) ||
                a.cells[Array.from(this.parentNode.children).indexOf(this)]
                  .textContent;
              const bValue =
                b.getAttribute(`data-${sortKey}`) ||
                b.cells[Array.from(this.parentNode.children).indexOf(this)]
                  .textContent;

              if (sortKey === "startTime" || sortKey === "endTime") {
                return isAscending
                  ? parseFloat(aValue) - parseFloat(bValue)
                  : parseFloat(bValue) - parseFloat(aValue);
              } else {
                return isAscending
                  ? aValue.localeCompare(bValue)
                  : bValue.localeCompare(aValue);
              }
            });

            rows.forEach((row) => tbody.appendChild(row));
            updatePaginationDisplay();
          });
        });

        // Pagination and Entries Per Page
        let currentPage = 1;
        let entriesPerPage = 10;

        document
          .getElementById("entriesPerPage")
          .addEventListener("change", function () {
            entriesPerPage = parseInt(this.value);
            currentPage = 1;
            updateTableDisplay();
          });

        function updateTableDisplay() {
          const rows = document.querySelectorAll("#reservationsBody tr");
          const startIndex = (currentPage - 1) * entriesPerPage;
          const endIndex = startIndex + entriesPerPage;

          rows.forEach((row, index) => {
            row.style.display =
              index >= startIndex && index < endIndex ? "" : "none";
          });

          updatePaginationDisplay();
          setupAutoRefresh(); // Refresh timers when table updates
        }

        function updatePaginationDisplay() {
          const totalRows = document.querySelectorAll(
            "#reservationsBody tr"
          ).length;
          const totalPages = Math.ceil(totalRows / entriesPerPage);
          const pagination = document.querySelector(".pagination");

          const startRow = (currentPage - 1) * entriesPerPage + 1;
          const endRow = Math.min(currentPage * entriesPerPage, totalRows);
          document.getElementById("showingFrom").textContent = startRow;
          document.getElementById("showingTo").textContent = endRow;
          document.getElementById("totalEntries").textContent = totalRows;

          const prevPage = document.getElementById("prevPage");
          const nextPage = document.getElementById("nextPage");

          prevPage.classList.toggle("disabled", currentPage === 1);
          nextPage.classList.toggle("disabled", currentPage === totalPages);

          const pageItems = pagination.querySelectorAll(
            ".page-item:not(#prevPage):not(#nextPage)"
          );
          pageItems.forEach((item) => item.remove());

          for (let i = 1; i <= totalPages; i++) {
            const pageItem = document.createElement("li");
            pageItem.className = `page-item ${
              i === currentPage ? "active" : ""
            }`;
            pageItem.innerHTML = `<a class="page-link" href="#">${i}</a>`;
            pageItem.addEventListener("click", (e) => {
              e.preventDefault();
              currentPage = i;
              updateTableDisplay();
            });
            nextPage.before(pageItem);
          }
        }

        // Search Functionality
        document
          .getElementById("reservationSearch")
          .addEventListener("input", function () {
            const searchTerm = this.value.toLowerCase();
            const rows = document.querySelectorAll("#reservationsBody tr");

            rows.forEach((row) => {
              const rowText = Array.from(row.cells)
                .map((cell) => cell.textContent.toLowerCase())
                .join(" ");
              row.style.display = rowText.includes(searchTerm) ? "" : "none";
            });

            currentPage = 1;
            updatePaginationDisplay();
          });

        // Initialize table display
        updateTableDisplay();

        // Pagination button event handlers
        document
          .getElementById("prevPage")
          .addEventListener("click", function (e) {
            e.preventDefault();
            if (currentPage > 1) {
              currentPage--;
              updateTableDisplay();
            }
          });

        document
          .getElementById("nextPage")
          .addEventListener("click", function (e) {
            e.preventDefault();
            const totalRows = document.querySelectorAll(
              "#reservationsBody tr"
            ).length;
            const totalPages = Math.ceil(totalRows / entriesPerPage);

            if (currentPage < totalPages) {
              currentPage++;
              updateTableDisplay();
            }
          });

        document.querySelectorAll(".launch-btn").forEach((btn) => {
          btn.addEventListener("click", function () {
            const deviceId = this.getAttribute("data-device-id");
            const ipType = this.getAttribute("data-ip-type");
            const reservationId = this.getAttribute("data-reservation-id");

            launchDashboard(deviceId, ipType, reservationId);
          });
        });

        function launchDashboard(deviceId, ipType, reservationId) {
          const baseUrl = "http://localhost:3000/dashboard";
          const params = new URLSearchParams({
            device: deviceId,
            ip_type: ipType,
            reservation: reservationId,
          });

          const fullUrl = `${baseUrl}?${params.toString()}`;

          console.log(`Navigating to: ${fullUrl}`);

          window.location.href = fullUrl;
        }
      });