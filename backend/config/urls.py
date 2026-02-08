"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin

admin.site.site_header = "Projectaris"
admin.site.site_title = "Projectaris"
admin.site.index_title = "Администрирование"

from django.db import connections
from django.db.utils import OperationalError
from django.http import JsonResponse
from django.urls import path, include
from rest_framework.authtoken.views import obtain_auth_token


def health(request):
    db_ok = True
    try:
        with connections["default"].cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
    except OperationalError:
        db_ok = False
    status = "ok" if db_ok else "degraded"
    return JsonResponse({"status": status, "db": db_ok})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health),
    path("api/users/", include("users.urls")),
    path("api/conf/", include("conf.urls")),
    path("api/auth/token/", obtain_auth_token),
]
